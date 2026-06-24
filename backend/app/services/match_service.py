import re
import json
from bs4 import BeautifulSoup

# Broad vocabulary of technical terms used for keyword overlap scoring
TECH_TERMS = {
    # Languages
    "python", "javascript", "typescript", "java", "kotlin", "scala", "golang", "go",
    "rust", "ruby", "php", "swift", "cplusplus", "csharp", "elixir", "erlang",
    "haskell", "clojure", "perl", "lua", "dart", "r",
    # Web / Backend frameworks
    "fastapi", "django", "flask", "express", "nestjs", "spring", "rails", "laravel",
    "gin", "fiber", "actix", "phoenix", "sinatra", "hapi", "koa",
    # Frontend
    "react", "vue", "angular", "svelte", "nextjs", "nuxt", "gatsby", "remix",
    "redux", "mobx", "zustand", "tailwind", "bootstrap", "webpack", "vite", "jest",
    # Databases
    "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "neo4j", "clickhouse", "snowflake", "bigquery",
    "mariadb", "oracle", "mssql", "couchdb", "influxdb",
    # Cloud / Infra
    "aws", "azure", "gcp", "kubernetes", "docker", "terraform", "ansible",
    "jenkins", "helm", "argocd", "prometheus", "grafana", "nginx", "caddy",
    # Data / ML / AI
    "pandas", "numpy", "sklearn", "tensorflow", "pytorch", "keras", "spark",
    "airflow", "kafka", "rabbitmq", "celery", "dbt", "mlflow", "langchain",
    # Concepts / methodologies
    "microservices", "graphql", "grpc", "rest", "websocket", "oauth", "jwt",
    "cicd", "devops", "mlops", "agile", "scrum", "tdd", "ddd", "cqrs",
    "distributed", "serverless", "event-driven",
    # Tools / platforms
    "git", "github", "gitlab", "bitbucket", "jira", "linux", "bash", "vim",
    "sqlalchemy", "pydantic", "celery", "sentry", "datadog",
}

# Non-technical domains: each maps to title keywords that signal the domain.
# If a job title clearly belongs to one of these domains and the CV has no
# evidence of it, the score is capped — signalling a profession mismatch.
_DOMAIN_SIGNALS: dict[str, list[str]] = {
    "Finance / Accounting": [
        "accountant", "accounts payable", "accounts receivable", "bookkeeper",
        "payroll", "tax specialist", "auditor", "financial controller",
        "treasury", "general ledger", "staff accountant", "ap specialist",
        "ar specialist", "cash management", "cost accountant",
    ],
    "Legal": [
        "attorney", "lawyer", "paralegal", "legal counsel", "solicitor",
        "legal assistant", "compliance officer", "contract manager",
        "in-house counsel",
    ],
    "Healthcare / Medical": [
        "nurse", "physician", "doctor", "therapist", "pharmacist",
        "clinical", "medical officer", "dentist", "surgeon", "radiologist",
        "occupational therapist", "speech therapist", "midwife",
    ],
    "Human Resources": [
        "hr generalist", "hr coordinator", "benefits specialist",
        "compensation analyst", "employee relations", "talent specialist",
        "hris analyst", "payroll specialist", "hr business partner",
    ],
    "Skilled Trades / Physical": [
        "electrician", "plumber", "carpenter", "mechanic", "welder",
        "hvac technician", "forklift", "warehouse associate",
        "truck driver", "delivery driver",
    ],
    "Education (non-tech)": [
        "kindergarten teacher", "primary school teacher", "secondary school teacher",
        "classroom teacher", "school counselor", "curriculum coordinator",
    ],
}

# Title qualifiers that indicate a tech flavour even in otherwise non-tech domains.
# e.g. "Legal Tech Engineer", "Healthcare Software Developer" should not be penalised.
_TECH_TITLE_QUALIFIERS = {
    "software", "engineer", "developer", "technical", "tech", "it", "digital",
    "platform", "data", "analytics", "systems", "cloud", "devops",
}


def _detect_domain_mismatch(job_title: str, cv_text: str) -> str | None:
    """
    Return the mismatched domain name if the job title signals a clearly
    non-technical domain that is absent from the CV, else return None.
    """
    title_lower = job_title.lower()

    # If the title contains a tech qualifier it's likely a tech-adjacent role — skip
    if any(q in title_lower for q in _TECH_TITLE_QUALIFIERS):
        return None

    for domain, signals in _DOMAIN_SIGNALS.items():
        title_hits = sum(1 for s in signals if s in title_lower)
        if title_hits == 0:
            continue
        # Domain detected in title — check if CV mentions it at all
        cv_hits = sum(1 for s in signals if s in cv_text)
        if cv_hits == 0:
            return domain

    return None


def _clean_text(raw) -> str:
    if isinstance(raw, dict):
        raw = json.dumps(raw)
    text = str(raw or "")
    if "<" in text:
        text = BeautifulSoup(text, "html.parser").get_text(separator=" ")
    return text


def _tokens(text: str) -> set:
    return set(re.findall(r"\b[a-z][a-z0-9+#.\-]{1,30}\b", text.lower()))


def match_cv_to_job(cv_summary: str, job) -> dict:
    desc_text = _clean_text(job.description_json)
    job_full = f"{job.title} {desc_text}"
    cv_text = cv_summary.lower()

    # --- Domain mismatch check (run before scoring) ---
    mismatched_domain = _detect_domain_mismatch(job.title or "", cv_text)

    # --- Tech stack matching (structured field, most reliable) ---
    job_tech = [t.lower().strip() for t in (job.tech_stack or [])]
    matched_tech = [t for t in job_tech if t in cv_text]
    missing_tech = [t for t in job_tech if t not in cv_text]
    # Default 0 (not 50) when no tech_stack — no data means no credit
    tech_score = (len(matched_tech) / len(job_tech) * 100) if job_tech else 0.0

    # --- Keyword overlap from description ---
    cv_kw = _tokens(cv_text) & TECH_TERMS
    job_kw = _tokens(job_full) & TECH_TERMS
    job_tech_set = set(job_tech)
    extra_job_kw = job_kw - job_tech_set
    extra_cv_kw = cv_kw - {t for t in matched_tech}

    matched_kw = extra_cv_kw & extra_job_kw
    missing_kw = extra_job_kw - cv_kw
    # Default 0 (not 50) when no tech keywords in the job — same reasoning
    kw_score = (len(matched_kw) / len(extra_job_kw) * 100) if extra_job_kw else 0.0

    # --- Combined score ---
    if job_tech:
        score = int(tech_score * 0.65 + kw_score * 0.35)
    elif extra_job_kw:
        score = int(kw_score)
    else:
        # No tech_stack AND no recognisable tech keywords in description.
        # Give a small base (15) to avoid always flooring at 5, but stay low.
        score = 15

    score = max(5, min(95, score))

    # --- Apply domain mismatch cap ---
    if mismatched_domain:
        score = min(score, 12)

    # --- Strengths ---
    if mismatched_domain:
        strengths = [
            "Soft skills (communication, remote work, seniority) may partially align"
        ]
    else:
        strengths = [f"Proficient in {t.title()}" for t in sorted(matched_tech)[:4]]
        strengths += [f"Experience with {k.title()}" for k in sorted(matched_kw)[:3]]
        if not strengths:
            strengths = ["General software engineering background applicable to this role"]

    # --- Gaps ---
    if mismatched_domain:
        gaps = [
            f"Fundamental domain mismatch — this is a {mismatched_domain} role, not a technology role",
            "Your CV shows no background in this field",
        ]
    else:
        gaps = [f"{t.title()} listed as required but not found in your CV" for t in sorted(missing_tech)[:4]]
        gaps += [f"{k.title()} mentioned in job description but absent from your CV" for k in sorted(missing_kw - job_tech_set)[:3]]
        if not gaps:
            gaps = ["No significant skill gaps detected"]

    # --- Summary ---
    if mismatched_domain:
        summary = (
            f"Profession mismatch detected — this is a {mismatched_domain} role. "
            f"Your background is in software engineering; the qualifications and "
            f"day-to-day responsibilities do not overlap. Score: {score}%."
        )
    elif job_tech:
        summary = (
            f"Your CV matches {len(matched_tech)} of {len(job_tech)} listed technologies "
            f"({int(tech_score)}% tech alignment). Overall compatibility: {score}%. "
        )
        if score >= 75:
            summary += "Strong candidate — the core requirements are well covered."
        elif score >= 50:
            summary += "Moderate fit — some gaps exist but the role may still be worth pursuing."
        else:
            summary += "Significant gaps present — consider whether this role aligns with your current profile."
    else:
        summary = f"Text-based analysis gives a compatibility score of {score}%. "
        if score >= 50:
            summary += "Moderate fit — the role appears broadly relevant to your background."
        else:
            summary += "Low alignment — the role may not match your core skills."

    # --- Suggestions ---
    if mismatched_domain:
        suggestions = [
            f"Skip this role — it requires {mismatched_domain} expertise, not software engineering",
            f"Add '{mismatched_domain.split('/')[0].strip()}' exclusion keywords to your role title filters to stop similar roles appearing",
        ]
    else:
        suggestions = []
        if missing_tech:
            suggestions.append(f"Address skill gaps in: {', '.join(t.title() for t in missing_tech[:3])}")
        if score < 70:
            suggestions.append("Tailor your CV summary to mirror the language used in this job description")
        if matched_tech:
            suggestions.append(
                f"Lead with your {', '.join(t.title() for t in matched_tech[:2])} experience in your cover letter"
            )
        if not suggestions:
            suggestions = ["Highlight specific project outcomes that demonstrate matching skills"]

    return {
        "score": score,
        "summary": summary,
        "strengths": strengths[:5],
        "gaps": gaps[:5],
        "suggestions": suggestions[:3],
    }
