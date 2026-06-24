import re
from app.services.match_service import TECH_TERMS

# Roles covering engineering, design, product, marketing, sales, finance, HR, ops, support
_ROLE_TERMS = [
    # Engineering — general
    "Software Engineer", "Software Developer",
    "Full Stack Engineer", "Full Stack Developer",
    "Frontend Engineer", "Frontend Developer",
    "Backend Engineer", "Backend Developer",
    # Engineering — mobile
    "Mobile Engineer", "Mobile Developer",
    "iOS Developer", "Android Developer",
    # Engineering — infrastructure
    "DevOps Engineer", "Platform Engineer",
    "Site Reliability Engineer", "Cloud Engineer",
    "Infrastructure Engineer", "Systems Engineer",
    "Embedded Engineer", "Firmware Engineer",
    # Engineering — data / AI
    "Machine Learning Engineer", "ML Engineer",
    "AI Engineer", "Data Scientist",
    "Data Engineer", "Data Analyst",
    "Business Intelligence Analyst", "BI Analyst",
    # Engineering — security / QA
    "Security Engineer", "Cybersecurity Engineer",
    "QA Engineer", "Test Engineer", "SDET",
    # Engineering — leadership
    "Solutions Architect", "Cloud Architect",
    "Tech Lead", "Engineering Manager",
    # Design
    "UI Designer", "UX Designer", "UI/UX Designer",
    "Product Designer", "Graphic Designer",
    "Visual Designer", "Brand Designer",
    "Web Designer", "Interaction Designer",
    "Motion Designer", "UX Researcher",
    # Product
    "Product Manager", "Product Owner",
    "Technical Product Manager", "Growth Manager",
    # Marketing
    "Marketing Manager", "Digital Marketing Manager",
    "Performance Marketing Manager",
    "Content Writer", "Copywriter", "Content Strategist",
    "SEO Specialist", "SEM Specialist",
    "Social Media Manager", "Community Manager",
    "Brand Manager", "Email Marketing Specialist",
    # Sales / Business Development
    "Account Executive", "Account Manager",
    "Business Development Manager",
    "Customer Success Manager", "Sales Engineer",
    "Sales Manager", "Sales Representative",
    # Finance / Accounting
    "Financial Analyst", "Finance Manager",
    "Accountant", "Controller",
    "Investment Analyst", "Risk Analyst",
    # HR / People
    "HR Manager", "Recruiter",
    "Talent Acquisition Specialist",
    "People Operations Manager", "HR Business Partner",
    # Operations / Project Management
    "Operations Manager", "Project Manager",
    "Program Manager", "Scrum Master",
    "Agile Coach", "Business Analyst",
    # Customer Support / Content
    "Customer Support Specialist",
    "Technical Support Engineer",
    "Technical Writer", "Content Manager",
]

# Tools and platforms beyond the engineering-focused TECH_TERMS in match_service
_EXTRA_TOOL_TERMS = [
    # Design
    "Figma", "Sketch", "Adobe XD", "InVision", "Zeplin",
    "Adobe Photoshop", "Adobe Illustrator", "Canva", "Framer",
    "Miro", "Balsamiq", "Principle",
    # Analytics / BI
    "Tableau", "Power BI", "Looker", "Google Analytics",
    "Mixpanel", "Amplitude", "Metabase", "Google Data Studio",
    "Hotjar", "Heap",
    # CRM / Marketing automation
    "Salesforce", "HubSpot", "Zendesk", "Intercom",
    "Mailchimp", "Marketo", "Segment", "Google Ads",
    "Facebook Ads", "Klaviyo",
    # Project management / Collaboration
    "Jira", "Confluence", "Notion", "Asana",
    "Trello", "Monday", "Linear", "ClickUp",
    # HR / Recruitment
    "Workday", "Greenhouse", "Lever", "BambooHR",
    # Finance / ERP
    "SAP", "QuickBooks", "Xero", "NetSuite",
    # General productivity
    "Google Workspace", "Microsoft Office",
    "Excel", "PowerPoint", "Slack", "Zoom",
]

# Sort longest first so multi-word terms like "Adobe XD" match before "Adobe"
_extra_pattern = re.compile(
    r'\b(' + '|'.join(re.escape(t) for t in sorted(_EXTRA_TOOL_TERMS, key=len, reverse=True)) + r')\b',
    re.IGNORECASE,
)

# Engineering tech terms pattern (reuse the set from match_service)
_tech_pattern = re.compile(
    r'\b(' + '|'.join(re.escape(t) for t in sorted(TECH_TERMS, key=len, reverse=True)) + r')\b',
    re.IGNORECASE,
)


def extract_suggestions(summary: str) -> dict:
    lower = summary.lower()

    # Role extraction — case-insensitive phrase match
    roles = [role for role in _ROLE_TERMS if role.lower() in lower]

    # Tech extraction — preserve original casing from the text, deduplicate by lowercase key
    seen: dict[str, str] = {}
    for m in _tech_pattern.finditer(summary):
        key = m.group(0).lower()
        if key not in seen:
            seen[key] = m.group(0)
    for m in _extra_pattern.finditer(summary):
        key = m.group(0).lower()
        if key not in seen:
            seen[key] = m.group(0)

    return {
        "role_titles": roles[:10],
        "tech_stack": sorted(seen.values(), key=str.lower)[:20],
    }
