import re
import fitz  # PyMuPDF
import os

class PIIRedactor:
    def __init__(self):
        # 1. Matches standard email addresses (e.g., name@email.com)
        self.email_regex = re.compile(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        )
        
        # 2. Matches optional +91 or 0 prefix and permits optional 
        # spaces or hyphens between any of the 10 mobile digits (e.g., 98765 43210)
        self.phone_regex = re.compile(
            r'(?:\+91[\-\s]?)?\b[6-9](?:[\-\s]?\d){9}\b'
        )
        
        # 3. Matches 12-digit Aadhaar Card sequences formatted as XXXX XXXX XXXX or XXXXXXXXXXXX
        self.aadhaar_regex = re.compile(
            r'\b\d{4}\s?\d{4}\s?\d{4}\b'
        )

        # 4. Matches standard Name fields (e.g. "Name: Shivam Adlakha", "Applicant: Rahul")
        self.name_regex = re.compile(
            r'(?i)(?:Name|Applicant)[\s:]*([A-Za-z\s]+)(?:\n|\r|$)'
        )

        # 5. Matches standard Address fields
        self.address_regex = re.compile(
            r'(?i)(?:Address)[\s:]*(.*?)(?:\n\n|\r\n\r\n|$)', re.DOTALL
        )

        # 6. Matches standard Dates (e.g. DD/MM/YYYY, YYYY-MM-DD)
        self.date_regex = re.compile(
            r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b'
        )
        
        self.patterns = [
            self.email_regex,
            self.phone_regex,
            self.aadhaar_regex,
            self.name_regex,
            self.address_regex,
            self.date_regex
        ]

    def redact_pdf(self, input_pdf_path, output_pdf_path):
        """
        Opens a PDF with PyMuPDF, searches for PII regex patterns, 
        physically draws black redaction rectangles over the matches,
        and saves a flattened, secure PDF to the output path.
        Returns the sanitized text of the entire document.
        """
        try:
            doc = fitz.open(input_pdf_path)
            clean_text_blocks = []
            
            for page in doc:
                text = page.get_text("text")
                if not text:
                    continue
                
                sanitized_page_text = text
                
                # Find all matches for all patterns on this page
                matches_to_redact = []
                for pattern in self.patterns:
                    for match in pattern.finditer(text):
                        # Extract the exact matched string to search for coordinates
                        matched_string = match.group(1).strip() if pattern.groups else match.group(0).strip()
                        if matched_string and len(matched_string) > 2:
                             matches_to_redact.append(matched_string)
                             sanitized_page_text = sanitized_page_text.replace(matched_string, "[REDACTED]")

                clean_text_blocks.append(sanitized_page_text)

                # Physically redact the matched strings in the PDF
                for target_string in matches_to_redact:
                    # Find all instances of this string on the page
                    areas = page.search_for(target_string)
                    for rect in areas:
                        # Add a black redaction annotation
                        page.add_redact_annot(rect, fill=(0, 0, 0))
                
                # Apply the redactions permanently to the page
                page.apply_redactions()

            # Save the document, forcing it to flatten so redactions cannot be reversed
            doc.save(output_pdf_path, deflate=True, garbage=4)
            doc.close()
            
            return "\n".join(clean_text_blocks)
            
        except Exception as e:
            print(f"Error during physical PDF redaction: {e}")
            return ""

    def process_document(self, input_pdf_path, output_pdf_path):
        """Unified wrapper to ingest, parse, physically redact, and return clean text"""
        clean_text = self.redact_pdf(input_pdf_path, output_pdf_path)
        return clean_text


# --- STANDALONE TESTING BLOCK ---
if __name__ == "__main__":
    pass