# AI Server for Debate Moderator Platform
# FastAPI-based server for toxicity detection, fallacy identification, and fact-checking

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Debate Moderator",
    description="AI-powered moderation for online debates",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Models ==============

class MessageAnalysisRequest(BaseModel):
    content: str
    userId: Optional[str] = None
    roomId: Optional[str] = None
    context: Optional[List[str]] = []

class ToxicityResult(BaseModel):
    isToxic: bool
    score: float
    severity: str  # low, medium, high, critical
    categories: Dict[str, float]

class FallacyResult(BaseModel):
    detected: List[Dict[str, Any]]
    suggestions: List[str]

class FactCheckResult(BaseModel):
    claims: List[Dict[str, Any]]
    overallCredibility: float

class AnalysisResponse(BaseModel):
    toxicity: ToxicityResult
    fallacies: FallacyResult
    factCheck: Optional[FactCheckResult] = None
    summary: str
    recommendations: List[str]
    approved: bool
    reason: Optional[str] = None
    isToxic: bool
    toxicityScore: float
    hasFallacy: bool

class FactCheckRequest(BaseModel):
    claim: str
    context: Optional[str] = None

# ============== Toxicity Detection ==============

# Common toxic patterns (simplified - in production use ML model)
TOXIC_PATTERNS = {
    'insults': [
        r'\b(idiot|stupid|dumb|moron|fool|loser|asshole|ass\s?hole|dickhead|retard|retarded|douche|douchebag)\b',
        r'\b(shut up|stfu|shut.*up)\b',
        r'\b(piece of shit|pos|worthless|useless)\b',
    ],
    'threats': [
        r'\b(kill|hurt|destroy|attack|beat|punch|stab|murder)\s+(you|him|her|them|yourself)\b',
        r'\b(i will|gonna|will|going to)\s+\w+\s+(you|your|yourself)\b',
        r'\b(fuck you|fuck off|go fuck)\b',
    ],
    'hate_speech': [
        r'\b(hate|despise|loathe)\s+(all|every|you)\b',
        r'\b(you suck|you suck ass)\b',
    ],
    'profanity': [
        r'\b(fuck|fucking|fucked|fucker|bullshit|shit|shitty|damn|hell|crap|piss|bitch|bitches|bastard|ass|arse|asshat)\b',
        r'\b(cock|dick|pussy|whore|slut|motherfucker|mother\s?fucker)\b',
        r'(f+u+c+k|s+h+i+t|b+i+t+c+h)',
    ],
}

def analyze_toxicity(text: str) -> ToxicityResult:
    """Analyze text for toxic content."""
    text_lower = text.lower()
    scores = {}
    total_score = 0.0
    
    for category, patterns in TOXIC_PATTERNS.items():
        category_score = 0.0
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                category_score += 0.3
        scores[category] = min(category_score, 1.0)
        total_score += scores[category]
    
    # Use the maximum category score as the overall toxicity score
    # (prevents dilution when only one category is triggered)
    overall_score = max(scores.values()) if scores else 0

    # Determine severity based on overall score
    if overall_score >= 0.7:
        severity = 'critical'
    elif overall_score >= 0.5:
        severity = 'high'
    elif overall_score >= 0.3:
        severity = 'medium'
    else:
        severity = 'low'

    return ToxicityResult(
        isToxic=overall_score >= 0.3,
        score=round(overall_score, 3),
        severity=severity,
        categories=scores
    )

# ============== Fallacy Detection ==============

FALLACIES = {
    'ad_hominem': {
        'patterns': [
            r"you're just|you are just",
            r"people like you",
            r"what do you know",
            r"you're too \w+ to understand",
        ],
        'name': 'Ad Hominem',
        'description': 'Attacking the person instead of addressing their argument',
        'suggestion': 'Focus on the argument itself rather than the person making it',
    },
    'straw_man': {
        'patterns': [
            r"so you're saying",
            r"what you really mean is",
            r"in other words, you think",
        ],
        'name': 'Straw Man',
        'description': 'Misrepresenting someone\'s argument to make it easier to attack',
        'suggestion': 'Address the actual argument being made',
    },
    'false_dichotomy': {
        'patterns': [
            r"either.*or",
            r"you're either with us or against us",
            r"only two options",
            r"it's black or white",
        ],
        'name': 'False Dichotomy',
        'description': 'Presenting only two options when more exist',
        'suggestion': 'Consider that there may be more than two alternatives',
    },
    'appeal_to_authority': {
        'patterns': [
            r"experts say",
            r"studies show",
            r"according to research",
            r"scientists believe",
        ],
        'name': 'Appeal to Authority',
        'description': 'Using authority as evidence without proper citation',
        'suggestion': 'Provide specific sources and citations',
    },
    'slippery_slope': {
        'patterns': [
            r"next thing you know",
            r"this will lead to",
            r"before you know it",
            r"where does it end",
        ],
        'name': 'Slippery Slope',
        'description': 'Assuming one event will inevitably lead to extreme consequences',
        'suggestion': 'Provide evidence for each step in the causal chain',
    },
    'hasty_generalization': {
        'patterns': [
            r"all \w+ are",
            r"every single",
            r"always",
            r"never",
            r"everyone knows",
        ],
        'name': 'Hasty Generalization',
        'description': 'Drawing broad conclusions from limited examples',
        'suggestion': 'Be careful about generalizing; consider exceptions',
    },
    'circular_reasoning': {
        'patterns': [
            r"because it is",
            r"it's true because it's true",
            r"that's just how it is",
        ],
        'name': 'Circular Reasoning',
        'description': 'Using the conclusion as a premise',
        'suggestion': 'Provide independent evidence for your claim',
    },
    'red_herring': {
        'patterns': [
            r"but what about",
            r"that's not the issue",
            r"speaking of which",
        ],
        'name': 'Red Herring',
        'description': 'Introducing an irrelevant topic to divert attention',
        'suggestion': 'Stay focused on the original topic',
    },
}

def detect_fallacies(text: str) -> FallacyResult:
    """Detect logical fallacies in text."""
    text_lower = text.lower()
    detected = []
    suggestions = []
    
    for fallacy_id, fallacy_data in FALLACIES.items():
        for pattern in fallacy_data['patterns']:
            if re.search(pattern, text_lower, re.IGNORECASE):
                detected.append({
                    'type': fallacy_id,
                    'name': fallacy_data['name'],
                    'description': fallacy_data['description'],
                    'confidence': 0.7,  # In production, use ML confidence
                })
                suggestions.append(fallacy_data['suggestion'])
                break  # One detection per fallacy type
    
    return FallacyResult(
        detected=detected,
        suggestions=list(set(suggestions))  # Remove duplicates
    )

# ============== Fact Checking (RAG Simulation) ==============

# Simulated knowledge base (in production, use vector DB + embeddings)
KNOWLEDGE_BASE = {
    'climate': {
        'facts': [
            'Global temperatures have risen approximately 1.1°C since pre-industrial times',
            'CO2 levels are at their highest in 800,000 years',
            '97% of climate scientists agree that human activities cause climate change',
        ],
    },
    'technology': {
        'facts': [
            'AI has been in development since the 1950s',
            'The first computer program was written by Ada Lovelace in the 1840s',
            'Moore\'s Law states that transistor density doubles about every two years',
        ],
    },
    'health': {
        'facts': [
            'Vaccines have eradicated smallpox globally',
            'Regular exercise reduces the risk of chronic diseases',
            'Sleep deprivation impairs cognitive function',
        ],
    },
}

def extract_claims(text: str) -> List[str]:
    """Extract factual claims from text."""
    # Simplified claim extraction (in production use NER/NLP)
    claim_indicators = [
        r"(?:studies show|research shows|according to|it's a fact that|the truth is|actually|in fact)",
        r"(?:\d+%|\d+ percent)",
        r"(?:always|never|all|every|none)",
    ]
    
    claims = []
    sentences = text.split('.')
    
    for sentence in sentences:
        for indicator in claim_indicators:
            if re.search(indicator, sentence, re.IGNORECASE):
                claims.append(sentence.strip())
                break
    
    return claims[:5]  # Limit to 5 claims

def check_fact(claim: str) -> Dict[str, Any]:
    """Check a claim against knowledge base."""
    claim_lower = claim.lower()
    
    for topic, data in KNOWLEDGE_BASE.items():
        if topic in claim_lower:
            # Check if claim aligns with known facts
            for fact in data['facts']:
                if any(word in claim_lower for word in fact.lower().split()[:3]):
                    return {
                        'claim': claim,
                        'verdict': 'likely_true',
                        'confidence': 0.75,
                        'source': f'Knowledge base: {topic}',
                        'relatedFacts': [fact],
                    }
    
    return {
        'claim': claim,
        'verdict': 'unverified',
        'confidence': 0.5,
        'source': 'No matching sources found',
        'relatedFacts': [],
    }

def analyze_facts(text: str) -> FactCheckResult:
    """Analyze text for factual claims and verify them."""
    claims = extract_claims(text)
    checked_claims = [check_fact(claim) for claim in claims]
    
    # Calculate overall credibility
    if checked_claims:
        credibility = sum(c['confidence'] for c in checked_claims) / len(checked_claims)
    else:
        credibility = 1.0  # No claims = no issues
    
    return FactCheckResult(
        claims=checked_claims,
        overallCredibility=round(credibility, 2)
    )

# ============== Main Analysis Endpoint ==============

@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_message(request: MessageAnalysisRequest):
    """
    Comprehensive analysis of a debate message.
    
    Returns toxicity analysis, detected fallacies, and fact-checking results.
    Blocks messages with high or critical toxicity.
    """
    try:
        content = request.content.strip()
        
        if not content:
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        
        # Perform analyses
        toxicity = analyze_toxicity(content)
        fallacies = detect_fallacies(content)
        fact_check = analyze_facts(content)
        
        # Generate recommendations
        recommendations = []
        
        if toxicity.isToxic:
            recommendations.append("Consider rephrasing to maintain a respectful tone")
        
        if fallacies.detected:
            recommendations.extend(fallacies.suggestions)
        
        if fact_check.overallCredibility < 0.7:
            recommendations.append("Consider providing sources for your claims")
        
        if not recommendations:
            recommendations.append("Your message appears well-constructed")
        
        # Generate summary
        issues = []
        if toxicity.isToxic:
            issues.append(f"toxicity ({toxicity.severity})")
        if fallacies.detected:
            issues.append(f"{len(fallacies.detected)} logical fallacy(ies)")
        if fact_check.claims and fact_check.overallCredibility < 0.7:
            issues.append("unverified claims")
        
        summary = f"Analysis complete. Issues found: {', '.join(issues) if issues else 'None'}"
        
        logger.info(f"Analyzed message: toxicity={toxicity.score}, fallacies={len(fallacies.detected)}")
        
        # Block message if toxic (high severity or critical)
        is_approved = not (toxicity.isToxic and toxicity.severity in ['high', 'critical'])
        block_reason = None
        if not is_approved:
            block_reason = f"Message contains toxic content ({toxicity.severity} severity). Please maintain a respectful tone."
        
        return AnalysisResponse(
            toxicity=toxicity,
            fallacies=fallacies,
            factCheck=fact_check,
            summary=summary,
            recommendations=recommendations,
            approved=is_approved,
            reason=block_reason,
            isToxic=toxicity.isToxic,
            toxicityScore=toxicity.score,
            hasFallacy=len(fallacies.detected) > 0,
        )
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fact-check")
async def fact_check_claim(request: FactCheckRequest):
    """
    Fact-check a specific claim.
    """
    try:
        result = check_fact(request.claim)
        return result
    except Exception as e:
        logger.error(f"Fact-check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "AI Debate Moderator",
        "version": "1.0.0"
    }

@app.get("/api/fallacies")
async def list_fallacies():
    """List all detectable fallacies."""
    return {
        "fallacies": [
            {
                "id": k,
                "name": v["name"],
                "description": v["description"],
            }
            for k, v in FALLACIES.items()
        ]
    }

# ============== Startup ==============

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
