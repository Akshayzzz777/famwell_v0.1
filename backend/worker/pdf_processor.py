"""PDF processing worker for extracting text and creating JSON."""

import logging
import time
from typing import Dict, Any, Optional
import PyPDF2
from io import BytesIO

logger = logging.getLogger(__name__)


class PDFProcessor:
    """PDF processing and text extraction."""

    @staticmethod
    def extract_text_from_pdf(pdf_content: bytes) -> Optional[str]:
        """Extract text from PDF.

        Args:
            pdf_content: PDF file content as bytes

        Returns:
            Extracted text or None if extraction fails
        """
        try:
            pdf_file = BytesIO(pdf_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            # Extract text from all pages
            extracted_text = []
            for page_num in range(len(pdf_reader.pages)):
                try:
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    if text:
                        extracted_text.append(text)
                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num}: {e}")

            if extracted_text:
                full_text = "\n".join(extracted_text)
                logger.info(f"Successfully extracted text from PDF ({len(full_text)} chars)")
                return full_text
            else:
                logger.warning("No text extracted from PDF")
                return None

        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}", exc_info=True)
            return None

    @staticmethod
    def get_pdf_metadata(pdf_content: bytes) -> Dict[str, Any]:
        """Get metadata from PDF.

        Args:
            pdf_content: PDF file content as bytes

        Returns:
            Metadata dictionary
        """
        try:
            pdf_file = BytesIO(pdf_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            metadata = {
                "pages": len(pdf_reader.pages),
                "has_text": False,
            }

            # Check if PDF has extractable text
            if len(pdf_reader.pages) > 0:
                first_page_text = pdf_reader.pages[0].extract_text()
                metadata["has_text"] = bool(first_page_text and first_page_text.strip())

            # Get document info if available
            if pdf_reader.metadata:
                metadata["title"] = pdf_reader.metadata.get("/Title", "")
                metadata["author"] = pdf_reader.metadata.get("/Author", "")
                metadata["subject"] = pdf_reader.metadata.get("/Subject", "")

            return metadata

        except Exception as e:
            logger.error(f"Failed to get PDF metadata: {e}", exc_info=True)
            return {"pages": 0, "has_text": False}

    @staticmethod
    def extract_tables_from_pdf(pdf_content: bytes) -> list:
        """Extract potential table data from PDF.

        Args:
            pdf_content: PDF file content as bytes

        Returns:
            List of table-like structures found
        """
        try:
            # This is a simplified implementation
            # For production, consider using specialized libraries like:
            # - tabula-py
            # - pdfplumber
            # - camelot-py

            pdf_file = BytesIO(pdf_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            tables = []
            for page_num in range(len(pdf_reader.pages)):
                try:
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()

                    # Simple table detection: look for aligned columns
                    # This is a placeholder - real implementation would be more sophisticated
                    if text and len(text.split("\n")) > 3:
                        lines = text.split("\n")
                        if all(len(line.split()) > 1 for line in lines[:3] if line.strip()):
                            tables.append({
                                "page": page_num + 1,
                                "type": "text_table",
                                "rows": len([l for l in lines if l.strip()])
                            })
                except Exception as e:
                    logger.debug(f"Error extracting tables from page {page_num}: {e}")

            logger.info(f"Found {len(tables)} potential tables in PDF")
            return tables

        except Exception as e:
            logger.error(f"Failed to extract tables from PDF: {e}")
            return []


class JSONExtractor:
    """Extract and structure JSON from PDF content."""

    @staticmethod
    def create_extracted_json(
        pdf_content: bytes,
        filename: str,
    ) -> Dict[str, Any]:
        """Create structured JSON from PDF.

        Args:
            pdf_content: PDF file content as bytes
            filename: Original filename

        Returns:
            Structured JSON data
        """
        processor = PDFProcessor()

        # Extract text
        extracted_text = processor.extract_text_from_pdf(pdf_content)
        if not extracted_text:
            extracted_text = "[No text could be extracted from this PDF]"

        # Get metadata
        metadata = processor.get_pdf_metadata(pdf_content)

        # Extract tables
        tables = processor.extract_tables_from_pdf(pdf_content)

        # Determine document type from filename and content
        document_type = JSONExtractor._infer_document_type(filename, extracted_text)

        # Create structured output
        output = {
            "document_type": document_type,
            "extracted_text": extracted_text[:10000],  # Limit length
            "metadata": {
                "pages": metadata.get("pages", 0),
                "language": "en",  # Default, could be enhanced with language detection
                "extraction_confidence": 0.85,  # Placeholder confidence score
                "has_text": metadata.get("has_text", False),
            }
        }

        if tables:
            output["tables"] = tables[:50]  # Limit number of tables

        logger.info(f"Created extracted JSON for: {filename}")
        return output

    @staticmethod
    def _infer_document_type(filename: str, text: str) -> str:
        """Infer document type from filename and content.

        Args:
            filename: Original filename
            text: Extracted text

        Returns:
            Document type string
        """
        filename_lower = filename.lower()

        # Check filename patterns
        if "invoice" in filename_lower:
            return "invoice"
        elif "receipt" in filename_lower:
            return "receipt"
        elif "contract" in filename_lower:
            return "contract"
        elif "form" in filename_lower or "application" in filename_lower:
            return "form"
        elif "report" in filename_lower:
            return "report"

        # Check content patterns
        text_lower = text.lower()
        if "invoice" in text_lower:
            return "invoice"
        elif "purchase" in text_lower or "receipt" in text_lower:
            return "receipt"
        elif "agreement" in text_lower or "terms" in text_lower:
            return "contract"

        return "document"


def process_pdf(pdf_content: bytes, filename: str) -> Dict[str, Any]:
    """Main PDF processing function.

    Args:
        pdf_content: PDF file content as bytes
        filename: Original filename

    Returns:
        Structured JSON from PDF
    """
    start_time = time.time()

    try:
        # Extract JSON from PDF
        extracted_json = JSONExtractor.create_extracted_json(pdf_content, filename)

        processing_time = time.time() - start_time
        extracted_json["processing_time_seconds"] = processing_time

        logger.info(
            f"PDF processing completed in {processing_time:.2f}s for {filename}"
        )

        return extracted_json

    except Exception as e:
        logger.error(f"PDF processing failed for {filename}: {e}", exc_info=True)
        raise
