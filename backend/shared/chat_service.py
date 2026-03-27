"""Azure OpenAI chat service for AI health assistant conversations."""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from config.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_MESSAGE = {
    "role": "system",
    "content": (
        "You are FamWell AI, a helpful and empathetic health assistant. "
        "You provide general health information, help users understand medical reports, "
        "and offer wellness suggestions. You are NOT a replacement for professional medical advice. "
        "Always recommend consulting a healthcare provider for specific medical concerns. "
        "Be concise, caring, and accurate."
    ),
}


def _generate_conversation_id() -> str:
    return f"conv_{uuid.uuid4().hex}"


def _generate_message_id() -> str:
    return f"msg_{uuid.uuid4().hex}"


async def get_or_create_conversation(prisma, user_id: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
    """Get existing conversation or create a new one."""
    if conversation_id:
        rows = await prisma.query_raw(
            "SELECT conversation_id, user_id, title, created_at, updated_at FROM chat_conversations WHERE conversation_id = $1 AND user_id = $2 LIMIT 1",
            conversation_id,
            user_id,
        )
        if rows:
            return rows[0]

    conv_id = _generate_conversation_id()
    rows = await prisma.query_raw(
        (
            "INSERT INTO chat_conversations (conversation_id, user_id, title) "
            "VALUES ($1, $2, $3) "
            "RETURNING conversation_id, user_id, title, created_at, updated_at"
        ),
        conv_id,
        user_id,
        "New Conversation",
    )
    return rows[0]


async def get_conversation_history(prisma, conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch message history for a conversation."""
    rows = await prisma.query_raw(
        (
            "SELECT message_id, conversation_id, role, content, created_at "
            "FROM chat_messages WHERE conversation_id = $1 "
            "ORDER BY created_at ASC LIMIT $2"
        ),
        conversation_id,
        limit,
    )
    return rows


async def save_message(prisma, conversation_id: str, role: str, content: str) -> Dict[str, Any]:
    """Save a chat message to the database."""
    msg_id = _generate_message_id()
    rows = await prisma.query_raw(
        (
            "INSERT INTO chat_messages (message_id, conversation_id, role, content) "
            "VALUES ($1, $2, $3, $4) "
            "RETURNING message_id, conversation_id, role, content, created_at"
        ),
        msg_id,
        conversation_id,
        role,
        content,
    )

    # Update conversation timestamp
    await prisma.execute_raw(
        "UPDATE chat_conversations SET updated_at = NOW() WHERE conversation_id = $1",
        conversation_id,
    )

    return rows[0]


async def call_azure_openai(messages: List[Dict[str, str]]) -> str:
    """Call Azure OpenAI API with conversation messages."""
    from shared.llm_client import get_llm_client

    llm = get_llm_client()
    return await llm.chat_async(messages, max_tokens=1024)


async def chat(prisma, user_id: str, message: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
    """Process a chat message: save, send to AI, save response, return."""
    conversation = await get_or_create_conversation(prisma, user_id, conversation_id)
    conv_id = conversation["conversation_id"]

    # Save user message
    await save_message(prisma, conv_id, "user", message)

    # Build message history for AI
    history = await get_conversation_history(prisma, conv_id)
    ai_messages = [SYSTEM_MESSAGE]
    for msg in history:
        ai_messages.append({"role": msg["role"], "content": msg["content"]})

    # Call AI
    try:
        ai_response = await call_azure_openai(ai_messages)
    except Exception as e:
        logger.error(f"AI chat error: {e}", exc_info=True)
        ai_response = "I'm sorry, I encountered an error processing your request. Please try again."

    # Save assistant response
    assistant_msg = await save_message(prisma, conv_id, "assistant", ai_response)

    # Update conversation title from first user message
    if conversation.get("title") == "New Conversation":
        title = message[:50] + ("..." if len(message) > 50 else "")
        await prisma.execute_raw(
            "UPDATE chat_conversations SET title = $1 WHERE conversation_id = $2",
            title,
            conv_id,
        )

    return {
        "conversation_id": conv_id,
        "message": {
            "message_id": assistant_msg["message_id"],
            "role": "assistant",
            "content": ai_response,
            "created_at": assistant_msg["created_at"],
        },
    }


async def list_conversations(prisma, user_id: str) -> List[Dict[str, Any]]:
    """List all conversations for a user with last message preview."""
    rows = await prisma.query_raw(
        (
            "SELECT c.conversation_id, c.user_id, c.title, c.created_at, c.updated_at, "
            "( SELECT content FROM chat_messages m WHERE m.conversation_id = c.conversation_id "
            "  ORDER BY m.created_at DESC LIMIT 1 ) AS last_message, "
            "( SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.conversation_id ) AS message_count "
            "FROM chat_conversations c "
            "WHERE c.user_id = $1 "
            "ORDER BY c.updated_at DESC"
        ),
        user_id,
    )
    return rows
