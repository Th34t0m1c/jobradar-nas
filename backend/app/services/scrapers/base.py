from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import re


@dataclass
class NormalizedJob:
    """Master schema — all platform adapters normalize into this format."""
    platform: str
    title: str
    company: str
    url: str
    description: str
    location: Optional[str] = None
    job_type: Optional[str] = None          # remote / hybrid / onsite
    experience_level: Optional[str] = None  # junior / mid / senior
    location_region: Optional[str] = None
    tech_stack: List[str] = field(default_factory=list)
    salary: Optional[str] = None
    posted_at: Optional[datetime] = None
    raw: Optional[dict] = field(default_factory=dict)


# Canonical tech list with regex patterns compiled once.
# Terms with only word chars use \b...\b; special-char terms use lookarounds.
_TECH_TERMS = [
    # Languages
    "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "Kotlin",
    "Ruby", "PHP", "Swift", "Scala", "Elixir", "Haskell", "Clojure",
    "Perl", "Lua", "Dart", "Groovy", "Bash",
    # Special-char languages — handled separately below
    "C#", "C++", "F#",
    # Frontend
    "React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt.js", "Remix",
    "Tailwind", "Bootstrap", "jQuery", "WebAssembly",
    # Backend
    "Node.js", "FastAPI", "Django", "Flask", "Rails", "Laravel", "Spring",
    "Express", "NestJS", "Gin", "Echo", "Fiber",
    ".NET", "ASP.NET",
    # Mobile
    "iOS", "Android", "Flutter", "React Native",
    # Data / ML
    "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "Spark",
    "Kafka", "Airflow", "dbt", "Snowflake", "Databricks",
    # Infra / DevOps
    "Docker", "Kubernetes", "Terraform", "Ansible", "Helm",
    "AWS", "Azure", "GCP", "Heroku", "Vercel",
    "CI/CD", "Jenkins", "GitHub Actions", "GitLab CI",
    "Linux", "Nginx", "Caddy",
    # Databases
    "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis",
    "Elasticsearch", "Cassandra", "DynamoDB", "CockroachDB",
    "Supabase", "Firebase", "PlanetScale",
    # APIs / protocols
    "GraphQL", "REST", "gRPC", "WebSocket",
    # Tools
    "Git", "Jira", "Figma", "Sentry",
]

# Build pattern → canonical name map once at import time
_TECH_PATTERNS: List[tuple] = []

def _build_patterns():
    for term in _TECH_TERMS:
        escaped = re.escape(term)
        # Terms with only word chars can use \b; others need lookarounds
        if re.fullmatch(r'\w+', term):
            pattern = re.compile(r'\b' + escaped + r'\b', re.IGNORECASE)
        else:
            pattern = re.compile(r'(?<!\w)' + escaped + r'(?!\w)', re.IGNORECASE)
        _TECH_PATTERNS.append((pattern, term))

_build_patterns()


class BaseScraper(ABC):
    """All platform scrapers inherit from this base class."""

    PLATFORM_NAME: str = ""

    @abstractmethod
    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        """
        Fetch jobs posted between from_dt and to_dt.
        Returns a list of NormalizedJob objects.
        """
        pass

    def normalize_experience_level(self, raw: str) -> Optional[str]:
        raw = raw.lower()
        if any(k in raw for k in ["senior", "sr.", "lead", "principal", "staff"]):
            return "senior"
        if any(k in raw for k in ["junior", "jr.", "entry", "graduate"]):
            return "junior"
        if any(k in raw for k in ["mid", "intermediate", "associate"]):
            return "mid"
        return None

    def extract_tech_stack(self, *texts: str, max_results: int = 10) -> List[str]:
        """Word-boundary tech extraction shared across all scrapers."""
        combined = " ".join(t for t in texts if t)
        seen: List[str] = []
        for pattern, canonical in _TECH_PATTERNS:
            if len(seen) >= max_results:
                break
            if pattern.search(combined):
                seen.append(canonical)
        return seen

    def normalize_job_type(self, raw: str) -> Optional[str]:
        raw = raw.lower()
        if "remote" in raw:
            return "remote"
        if "hybrid" in raw:
            return "hybrid"
        if any(k in raw for k in ["onsite", "on-site", "in-office", "in office"]):
            return "onsite"
        return None
