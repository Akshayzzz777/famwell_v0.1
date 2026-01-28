"""
Database connection and management using Prisma ORM.
Handles PostgreSQL connections with proper lifecycle management.
"""

from prisma import Prisma
from prisma.errors import PrismaError
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Global database instance
_db_instance: Optional[Prisma] = None


class DatabaseManager:
    """
    Manages Prisma database connections and operations.
    Provides singleton pattern for database access.
    """

    def __init__(self, database_url: str):
        """
        Initialize database manager.

        Args:
            database_url: PostgreSQL connection string
        """
        self.database_url = database_url
        self.client = Prisma(datasource={"url": database_url})

    async def connect(self) -> None:
        """
        Establish database connection.
        Should be called on application startup.
        """
        try:
            await self.client.connect()
            logger.info("Database connection established")
        except PrismaError as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def disconnect(self) -> None:
        """
        Close database connection.
        Should be called on application shutdown.
        """
        try:
            await self.client.disconnect()
            logger.info("Database connection closed")
        except PrismaError as e:
            logger.error(f"Error disconnecting from database: {e}")
            raise

    async def health_check(self) -> bool:
        """
        Test database connectivity.

        Returns:
            True if connection is healthy, False otherwise
        """
        try:
            # Execute a simple query to verify connection
            result = await self.client.user.find_first()
            logger.info("Database health check passed")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def init_db(self) -> None:
        """
        Initialize database schema.
        Run Prisma migrations.
        """
        try:
            # Prisma migrations are run via CLI: prisma migrate deploy
            logger.info("Database schema initialization requires: prisma migrate deploy")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise


def get_db_manager(database_url: str) -> DatabaseManager:
    """
    Get or create database manager instance (singleton pattern).

    Args:
        database_url: PostgreSQL connection string

    Returns:
        DatabaseManager instance
    """
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseManager(database_url)
    return _db_instance


def get_prisma_client(database_url: str) -> Prisma:
    """
    Get Prisma client instance.

    Args:
        database_url: PostgreSQL connection string

    Returns:
        Prisma client
    """
    manager = get_db_manager(database_url)
    return manager.client
