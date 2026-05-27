import re
from pypdf import PdfReader

class PIIRedactor:
    def __init__(self):
        # 1. Matches standard email addresses (e.g., name@email.com)
        self.email_regex = re.compile(
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        )
        
        # 2. FIXED: Matches optional +91 or 0 prefix and permits optional 
        # spaces or hyphens between any of the 10 mobile digits (e.g., 98765 43210)
        self.phone_regex = re.compile(
            r'(?:\+91[\-\s]?)?\b[6-9](?:[\-\s]?\d){9}\b'
        )
        
        # 3. Matches 12-digit Aadhaar Card sequences formatted as XXXX XXXX XXXX or XXXXXXXXXXXX
        self.aadhaar_regex = re.compile(
            r'\b\d{4}\s?\d{4}\s?\d{4}\b'
        )

    def extract_text_from_pdf(self, pdf_path):
        """Reads a local PDF file path and extracts its plain text content page by page"""
        text_content = []
        try:
            reader = PdfReader(pdf_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_content.append(page_text)
            return "\n".join(text_content)
        except Exception as e:
            print(f"Error reading PDF asset line array: {e}")
            return ""

    def redact_text(self, raw_text):
        """Sweeps raw string payloads and replaces sensitive identifiers with secure masks"""
        if not raw_text:
            return ""
            
        sanitized = raw_text
        
        # Scrub Emails
        sanitized = self.email_regex.sub("[REDACTED EMAIL]", sanitized)
        
        # Scrub Phone Numbers
        sanitized = self.phone_regex.sub("[REDACTED PHONE]", sanitized)
        
        # Scrub Aadhaar Numbers
        sanitized = self.aadhaar_regex.sub("[REDACTED AADHAAR]", sanitized)
        
        return sanitized

    def process_document(self, pdf_path):
        """Unified wrapper to ingest, parse, and clean an incoming document file asset"""
        raw_extracted_text = self.extract_text_from_pdf(pdf_path)
        clean_text = self.redact_text(raw_extracted_text)
        return clean_text


# --- STANDALONE TESTING BLOCK ---
if __name__ == "__main__":
    # This block only runs when you execute 'python pii.py' directly in your terminal.
    # It allows you to test your patterns locally without booting up the entire Flask app.
    
    test_sample_text = """
    To,
    The Public Information Officer,
    Department of Urban Development.
    From: Rahul Sharma (email: rahul.sharma99@gmail.com, phone: +91 98765 43210).
    Subject: Request for certified copies under RTI Act 2005.
    My verified Aadhaar identity verification number is: 5234 8100 1294.
    Kindly provide budget layout copies regarding project road repair metrics.
    """
    
    print("--- STARTING REGEX PIECE-WISE VALIDATION TEST ---")
    redactor = PIIRedactor()
    cleaned_output = redactor.redact_text(test_sample_text)
    
    print("\n[Original Input text String]:")
    print(test_sample_text.strip())
    
    print("\n[Sanitized Safe Text Output]:")
    print(cleaned_output.strip())