from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.config import get_settings
from app.models.common import (
    AnimationStyle,
    GroundingCategory,
    Language,
    SceneType,
    UncertaintyLevel,
    VerificationImportance,
)
from app.models.lesson import (
    Caption,
    Chapter,
    GlossaryEntry,
    Lesson,
    Scene,
    VerificationItem,
    VisualSpec,
)
from app.models.request import LessonRequest
from app.services.gemini_client import GeminiClient
from app.utils.language import estimate_duration_ms

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
jinja_env = Environment(loader=FileSystemLoader(PROMPTS_DIR), autoescape=False)


class LessonBuilder:
    """Orchestrates lesson generation from prompts or provides deterministic fixtures."""

    def __init__(self, gemini_client: GeminiClient | None = None) -> None:
        if gemini_client is not None:
            self.gemini_client = gemini_client
        else:
            settings = get_settings()
            self.gemini_client = GeminiClient(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                timeout_seconds=settings.gemini_timeout_seconds,
            )

    def build_fixture(self, request: LessonRequest) -> Lesson:
        """Construct a complete, valid Lesson fixture tailored to the requested topic and language.

        Selects a dedicated JWT fixture if the request relates to JWT/authentication,
        or defaults to the Python optimization fixture.
        """
        content_lower = request.content.lower()
        jwt_keywords = ("jwt", "json web token", "bearer", "token", "auth", "signature", "claims")
        if any(kw in content_lower for kw in jwt_keywords):
            return self.build_jwt_fixture(request)
        return self.build_python_fixture(request)

    def build_jwt_fixture(self, request: LessonRequest) -> Lesson:
        """Construct a complete, valid JWT (JSON Web Token) fixture in the requested language."""
        lang = request.language

        if lang == Language.HI:
            lesson_title = "JSON Web Tokens (JWT) को समझें"
            chap1_title = "मूल आर्किटेक्चर और टोकन संरचना"
            chap1_summary = "स्टेटलेस प्रमाणीकरण और JWT के तीन प्रमुख भागों की संरचना को समझें।"
            scene1_title = "JSON Web Token (JWT) क्या है?"
            scene1_narration = "JSON Web Token दो पक्षों के बीच सुरक्षित रूप से डेटा और क्लेम्स ट्रांसफर करने का एक कॉम्पैक्ट और स्टेटलेस तरीका है।"
            scene2_title = "टोकन संरचना: हेडर, पेलोड और सिग्नेचर"
            scene2_narration = "JWT में डॉट्स से अलग किए गए तीन बेस64url भाग होते हैं: एल्गोरिदम हेडर, पेलोड क्लेम्स और क्रिप्टोग्राफ़िक सिग्नेचर।"
            chap2_title = "प्रमाणीकरण प्रवाह और सत्यापन"
            chap2_summary = "यूज़र लॉगिन से लेकर प्रोटेक्टेड रिसोर्स पर सिग्नेचर सत्यापन तक पूरे अनुरोध प्रवाह को समझें।"
            scene3_title = "स्टेटलेस प्रमाणीकरण प्रवाह"
            scene3_narration = "क्लाइंट ऑथ सर्वर को क्रेडेंशियल्स भेजता है, हस्ताक्षरित JWT प्राप्त करता है, और प्रोटेक्टेड रिसोर्सेज एक्सेस करने के लिए इसे ऑथराइजेशन हेडर में भेजता है।"
            scene4_title = "टोकन सिग्नेचर और क्लेम्स का सत्यापन"
            scene4_narration = "सत्यापन आउटपुट की जांच करने पर पुष्टि होती है कि क्रिप्टोग्राफ़िक सिग्नेचर पेलोड हैश से मेल खाता है और टोकन समाप्त नहीं हुआ है।"
            glossary = [
                GlossaryEntry(
                    term="JSON Web Token (JWT)",
                    definition="पार्टियों के बीच JSON ऑब्जेक्ट के रूप में सुरक्षित जानकारी ट्रांसफर करने का एक खुला कॉम्पैक्ट मानक (RFC 7519)।",
                    example="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                ),
                GlossaryEntry(
                    term="डिजिटल सिग्नेचर (Digital Signature)",
                    definition="हेडर, पेलोड और सीक्रेट कुंजी से तैयार किया गया क्रिप्टोग्राफ़िक हैश जिससे डेटा अखंडता की पुष्टि होती है।",
                    example="HMACSHA256(base64Url(header) + '.' + base64Url(payload), secret)",
                ),
                GlossaryEntry(
                    term="स्टेटलेस ऑथ (Stateless Auth)",
                    definition="प्रमाणीकरण जिसमें सर्वर को सत्र या सेशन डेटाबेस में स्टोर नहीं करना पड़ता; टोकन स्वयं संपूर्ण होता है।",
                    example="Authorization: Bearer <token>",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-jwt-001",
                    statement="कभी भी अनएन्क्रिप्टेड JWT पेलोड में पासवर्ड या निजी चाबियाँ जैसे संवेदनशील डेटा स्टोर न करें।",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-002",
                    statement="एल्गोरिदम भ्रम हमलों से बचने के लिए 'none' एल्गोरिदम को सख्ती से अस्वीकार करें।",
                    importance=VerificationImportance.CAUTION,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-003",
                    statement="टोकन की समाप्ति अवधि (exp claim) हमेशा सत्यापित करें ताकि पुराने टोकन का दुरुपयोग न हो।",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.INFERRED,
                ),
            ]
        elif lang == Language.HINGLISH:
            lesson_title = "JSON Web Tokens (JWT) Architecture Seekhein"
            chap1_title = "Core Architecture aur Token Structure"
            chap1_summary = "Stateless authentication aur JWT ke teen main parts ki anatomy dekhein."
            scene1_title = "JSON Web Token (JWT) kya hota hai?"
            scene1_narration = "JSON Web Token do parties ke beech claims aur data transfer karne ka ek compact aur stateless standard format hai."
            scene2_title = "Token Structure: Header, Payload aur Signature"
            scene2_narration = "JWT mein teen parts hote hain dots se separated: Algorithm Header, Claims Payload, aur Cryptographic Signature."
            chap2_title = "Authentication Flow aur Verification"
            chap2_summary = "User login se lekar protected API resource par signature verification ka request flow samjhein."
            scene3_title = "Stateless Request Authentication Flow"
            scene3_narration = "Client Auth Server ko credentials bhejta hai, signed JWT receive karta hai, aur protected API endpoints par Bearer token ke saath access leta hai."
            scene4_title = "Token Signature aur Expiration Verification"
            scene4_narration = "Verification check confirm karta hai ki cryptographic signature payload hash se match ho raha hai aur token valid aur unexpired hai."
            glossary = [
                GlossaryEntry(
                    term="JSON Web Token (JWT)",
                    definition="Compact RFC 7519 standard jisse client aur server securely JSON claims exchange karte hain.",
                    example="Authorization: Bearer <jwt_token>",
                ),
                GlossaryEntry(
                    term="HMAC Signature",
                    definition="Cryptographic hash jo header, payload aur secret key combine karke tamper-proofing provide karta hai.",
                    example="HMACSHA256(base64(header) + '.' + base64(payload), secret)",
                ),
                GlossaryEntry(
                    term="Bearer Token",
                    definition="Security token jo holder ko protected resource access allow karta hai bina server session state ke.",
                    example="Authorization: Bearer eyJhbGciOi...",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-jwt-001",
                    statement="Confirm karein ki sensitive data jaise passwords kabhi JWT payload mein expose na ho.",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-002",
                    statement="Algorithm confusion attacks rokne ke liye 'none' alg aur weak keys ko reject karein.",
                    importance=VerificationImportance.CAUTION,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-003",
                    statement="Verify karein ki exp (expiration) claim har incoming request par check hota hai.",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.INFERRED,
                ),
            ]
        else:  # Default to English
            lesson_title = "Understanding JSON Web Tokens (JWT)"
            chap1_title = "Core Architecture & Token Structure"
            chap1_summary = "Explore stateless authentication and the three-part anatomy of a JSON Web Token."
            scene1_title = "What is a JSON Web Token?"
            scene1_narration = "A JSON Web Token is a compact, URL-safe means of representing claims to be transferred between two parties in stateless authentication."
            scene2_title = "Token Anatomy: Header, Payload & Signature"
            scene2_narration = "A JWT consists of three base64url parts separated by dots: the algorithm header, the payload claims, and the cryptographic signature."
            chap2_title = "Authentication Flow & Verification"
            chap2_summary = "Trace the request lifecycle from user login to stateless signature verification on protected resources."
            scene3_title = "Stateless Authentication Flow"
            scene3_narration = "The client posts credentials to the Auth Server, receives a signed JWT, and presents it in the Authorization Bearer header to access Protected Resources."
            scene4_title = "Verifying Token Signature & Claims"
            scene4_narration = "Inspecting the verification output confirms that the cryptographic signature matches the payload hash and the token has not expired."
            glossary = [
                GlossaryEntry(
                    term="JSON Web Token (JWT)",
                    definition="A compact open standard (RFC 7519) for transmitting secure claims between parties as a JSON object.",
                    example="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                ),
                GlossaryEntry(
                    term="Cryptographic Signature",
                    definition="A hash calculated from the base64url header and payload using a secret key to guarantee data integrity.",
                    example="HMACSHA256(base64Url(header) + '.' + base64Url(payload), secret)",
                ),
                GlossaryEntry(
                    term="Stateless Authentication",
                    definition="An auth mechanism where the server does not persist session state; all identity claims are carried in the token.",
                    example="Authorization: Bearer <token>",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-jwt-001",
                    statement="Never store passwords, private keys, or sensitive credentials inside an unencrypted JWT payload.",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-002",
                    statement="Enforce strict server-side algorithm whitelisting to reject 'none' and insecure hashing algorithms.",
                    importance=VerificationImportance.CAUTION,
                    grounding=GroundingCategory.OBSERVED,
                ),
                VerificationItem(
                    id="chk-jwt-003",
                    statement="Always validate the expiration (exp) and issuer (iss) claims before accepting request context.",
                    importance=VerificationImportance.MUST_KNOW,
                    grounding=GroundingCategory.INFERRED,
                ),
            ]

        jwt_s1_dur = max(estimate_duration_ms(scene1_narration, lang), 6000)
        jwt_s2_dur = max(estimate_duration_ms(scene2_narration, lang), 7000)
        jwt_s3_dur = max(estimate_duration_ms(scene3_narration, lang), 8000)
        jwt_s4_dur = max(estimate_duration_ms(scene4_narration, lang), 6000)

        s1_mid = jwt_s1_dur // 2
        jwt_scene1 = Scene(
            scene_id="jwt-scene-01-intro",
            title=scene1_title,
            narration_text=scene1_narration,
            visual=VisualSpec(
                scene_type=SceneType.TEXT,
                highlighted_terms=["JWT", "stateless", "claims", "bearer token"],
                animation_style=AnimationStyle.FADE_SLIDE,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s1_mid,
                    text=scene1_narration[: len(scene1_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s1_mid,
                    duration_ms=jwt_s1_dur - s1_mid,
                    text=scene1_narration[len(scene1_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.OBSERVED,
            what_to_verify=["Verify that tokens are transmitted strictly over TLS/HTTPS."],
        )

        s2_mid = jwt_s2_dur // 2
        jwt_scene2 = Scene(
            scene_id="jwt-scene-02-structure",
            title=scene2_title,
            narration_text=scene2_narration,
            visual=VisualSpec(
                scene_type=SceneType.CODE_DIFF,
                before_code="// Encoded JWT String (header.payload.signature)\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYiLCJuYW1lIjoiQWxpY2UiLCJyb2xlIjoiYWRtaW4ifQ.4z9sK7b3QJ8nO6p2L...",
                after_code='// Decoded JWT JSON Structure\n{\n  "header": {\n    "alg": "HS256",\n    "typ": "JWT"\n  },\n  "payload": {\n    "sub": "123456",\n    "name": "Alice",\n    "role": "admin"\n  },\n  "signature": "HMACSHA256(base64Url(header) + \'.\' + base64Url(payload), secret)"\n}',
                language="json",
                highlighted_terms=["header", "payload", "signature", "HS256", "admin"],
                animation_style=AnimationStyle.HIGHLIGHT_SWEEP,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s2_mid,
                    text=scene2_narration[: len(scene2_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s2_mid,
                    duration_ms=jwt_s2_dur - s2_mid,
                    text=scene2_narration[len(scene2_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.OBSERVED,
            what_to_verify=["Verify token payload contains no secret keys or passwords."],
        )

        jwt_chap1 = Chapter(
            chapter_id="jwt-chap-01-structure",
            title=chap1_title,
            summary=chap1_summary,
            scenes=[jwt_scene1, jwt_scene2],
        )

        s3_mid = jwt_s3_dur // 2
        jwt_scene3 = Scene(
            scene_id="jwt-scene-03-flow",
            title=scene3_title,
            narration_text=scene3_narration,
            visual=VisualSpec(
                scene_type=SceneType.DIAGRAM,
                mermaid_definition="graph LR\n  Client[Client App] -->|1. Credentials| AuthServer[Auth Server]\n  AuthServer -->|2. Issues Signed JWT| Client\n  Client -->|3. Bearer Token| ResourceAPI[Resource API]\n  ResourceAPI -->|4. Verify Signature| ProtectedData[(Protected Resource)]",
                highlighted_terms=["Client App", "Auth Server", "Resource API", "Bearer Token", "Protected Resource"],
                animation_style=AnimationStyle.FADE_SLIDE,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s3_mid,
                    text=scene3_narration[: len(scene3_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s3_mid,
                    duration_ms=jwt_s3_dur - s3_mid,
                    text=scene3_narration[len(scene3_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.INFERRED,
            what_to_verify=["Verify secret key rotation and shared key security."],
        )

        s4_mid = jwt_s4_dur // 2
        jwt_scene4 = Scene(
            scene_id="jwt-scene-04-verify",
            title=scene4_title,
            narration_text=scene4_narration,
            visual=VisualSpec(
                scene_type=SceneType.TERMINAL,
                command="jwt verify --token $TOKEN --secret $SECRET_KEY",
                output="Signature Status: VALID (alg=HS256, sub=123456, exp=valid)",
                exit_code=0,
                highlighted_terms=["Signature Status", "VALID", "HS256", "exp=valid"],
                animation_style=AnimationStyle.TYPEWRITER,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s4_mid,
                    text=scene4_narration[: len(scene4_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s4_mid,
                    duration_ms=jwt_s4_dur - s4_mid,
                    text=scene4_narration[len(scene4_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.LOW,
            uncertainty_note="Local verification requires server secret or public key certificate.",
            grounding_category=GroundingCategory.NEEDS_VERIFICATION,
            what_to_verify=["Ensure server clock skew is within acceptable tolerance."],
        )

        jwt_chap2 = Chapter(
            chapter_id="jwt-chap-02-auth",
            title=chap2_title,
            summary=chap2_summary,
            scenes=[jwt_scene3, jwt_scene4],
        )

        jwt_total_dur = jwt_s1_dur + jwt_s2_dur + jwt_s3_dur + jwt_s4_dur

        return Lesson(
            lesson_id="lesson-fixture-jwt",
            title=lesson_title,
            language=lang,
            content_type=request.content_type,
            total_estimated_duration_ms=jwt_total_dur,
            chapters=[jwt_chap1, jwt_chap2],
            glossary=glossary,
            verification_checklist=verification,
            gemini_model_version="gemini-3.8-flash",
            generated_at=datetime.now(UTC).isoformat(),
        )

    def build_python_fixture(self, request: LessonRequest) -> Lesson:
        """Construct the Python list comprehension fixture tailored to the requested language."""
        lang = request.language

        if lang == Language.HI:
            lesson_title = "पायथन लिस्ट कॉम्प्रिहेंशन को समझें"
            chap_title = "मूल बातें और सिंटैक्स रूपांतरण"
            chap_summary = "इस अध्याय में हम पारंपरिक लूप्स को आधुनिक लिस्ट कॉम्प्रिहेंशन में बदलना सीखेंगे।"
            scene1_title = "लिस्ट कॉम्प्रिहेंशन क्या है?"
            scene1_narration = "लिस्ट कॉम्प्रिहेंशन पायथन में मौजूदा लिस्ट या इटरेबल से नई लिस्ट बनाने का एक संक्षिप्त और सुंदर तरीका है।"
            scene2_title = "लूप से कॉम्प्रिहेंशन में परिवर्तन"
            scene2_narration = "यहाँ हम देख सकते हैं कि कैसे तीन लाइन के फॉर-लूप को एक ही पठनीय लाइन में संक्षिप्त किया जा सकता है।"
            glossary = [
                GlossaryEntry(
                    term="लिस्ट कॉम्प्रिहेंशन (List Comprehension)",
                    definition="पायथन में आइटम्स को फिल्टर और ट्रांसफॉर्म करके नई लिस्ट बनाने का संक्षिप्त सिंटैक्स।",
                    example="[x * 2 for x in items if x > 0]",
                ),
                GlossaryEntry(
                    term="सिंटैक्टिक शुगर (Syntactic Sugar)",
                    definition="प्रोग्रामिंग भाषा में ऐसा सिंटैक्स जो कोड को लिखना और पढ़ना अधिक सरल बनाता है।",
                    example="x += 1 पारंपरिक x = x + 1 का सिंटैक्टिक शुगर है।",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="सुनिश्चित करें कि इटरेबल खाली होने पर भी कॉम्प्रिहेंशन सुरक्षित रूप से खाली लिस्ट लौटाता है।",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="यदि लॉजिक में एक से अधिक नेस्टेड लूप्स हों, तो साधारण लूप्स अधिक पठनीय हो सकते हैं।",
                    importance=VerificationImportance.CAUTION,
                ),
            ]
        elif lang == Language.HINGLISH:
            lesson_title = "Python List Comprehensions Seekhein"
            chap_title = "Basics aur Syntax Transformation"
            chap_summary = "Iss chapter mein hum regular for-loop ko concise list comprehension mein convert karna seekhenge."
            scene1_title = "List Comprehension kya hota hai?"
            scene1_narration = "List comprehension Python mein ek concise aur expressive tareeqa hai nayi list create karne ka."
            scene2_title = "Loop se Comprehension mein conversion"
            scene2_narration = "Dekhiye kaise 3 lines ka code ek single readable line mein convert ho jaata hai bina kisi complexity ke."
            glossary = [
                GlossaryEntry(
                    term="List Comprehension",
                    definition="Python ka short syntax jisse existing list se nayi list transform ki jaati hai.",
                    example="[num ** 2 for num in numbers]",
                ),
                GlossaryEntry(
                    term="Syntactic Sugar",
                    definition="Syntax jo program ke features ko humans ke liye likhna aur samajhna aasan banata hai.",
                    example="x += 1 instead of x = x + 1",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="Confirm karein ki empty list par iteration bina runtime error ke empty list return kare.",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="Heavy nested loops mein list comprehension readability ko affect kar sakti hai.",
                    importance=VerificationImportance.CAUTION,
                ),
            ]
        else:  # Default to English
            lesson_title = "Understanding Python List Comprehensions"
            chap_title = "Fundamentals & Syntax Transformation"
            chap_summary = "Learn how to transform traditional verbose loops into clean and idiomatic list comprehensions."
            scene1_title = "What is a List Comprehension?"
            scene1_narration = "A list comprehension provides a concise and elegant syntax for creating lists based on existing iterables."
            scene2_title = "Transforming Loops into Comprehensions"
            scene2_narration = "Notice how three lines of procedural loop code condense into a single declarative expression."
            glossary = [
                GlossaryEntry(
                    term="List Comprehension",
                    definition="A concise syntax to transform and filter elements of an iterable into a new list.",
                    example="[x * 2 for x in items if x > 0]",
                ),
                GlossaryEntry(
                    term="Syntactic Sugar",
                    definition="Syntax within a programming language designed to make things easier to read or express.",
                    example="Using x += 1 instead of x = x + 1",
                ),
            ]
            verification = [
                VerificationItem(
                    id="chk-001",
                    statement="Confirm the comprehension constructs a new list object without mutating the source iterable.",
                    importance=VerificationImportance.MUST_KNOW,
                ),
                VerificationItem(
                    id="chk-002",
                    statement="For multi-nested loops or complex conditionals, a standard for-loop may offer superior readability.",
                    importance=VerificationImportance.CAUTION,
                ),
            ]

        # Chapter 1 scene durations
        scene1_duration = max(estimate_duration_ms(scene1_narration, lang), 5000)
        scene2_duration = max(estimate_duration_ms(scene2_narration, lang), 6000)

        # Slice scene 1 into timed captions for progression
        s1_mid = scene1_duration // 2
        scene1 = Scene(
            scene_id="scene-01-intro",
            title=scene1_title,
            narration_text=scene1_narration,
            visual=VisualSpec(
                scene_type=SceneType.TEXT,
                highlighted_terms=["list comprehension", "syntax", "iterable"],
                animation_style=AnimationStyle.FADE_SLIDE,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s1_mid,
                    text=scene1_narration[: len(scene1_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s1_mid,
                    duration_ms=scene1_duration - s1_mid,
                    text=scene1_narration[len(scene1_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.OBSERVED,
            what_to_verify=["Verify input iterable is valid and non-null before comprehension."],
        )

        s2_mid = scene2_duration // 2
        scene2 = Scene(
            scene_id="scene-02-diff",
            title=scene2_title,
            narration_text=scene2_narration,
            visual=VisualSpec(
                scene_type=SceneType.CODE_DIFF,
                before_code="result = []\nfor x in items:\n    result.append(x * 2)",
                after_code="result = [x * 2 for x in items]",
                language="python",
                highlighted_terms=["append", "for", "in", "items"],
                animation_style=AnimationStyle.HIGHLIGHT_SWEEP,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s2_mid,
                    text=scene2_narration[: len(scene2_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s2_mid,
                    duration_ms=scene2_duration - s2_mid,
                    text=scene2_narration[len(scene2_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.OBSERVED,
            what_to_verify=["Check that loop variable does not shadow outer scope variables."],
        )

        chapter1 = Chapter(
            chapter_id="chap-01-transformation",
            title=chap_title,
            summary=chap_summary,
            scenes=[scene1, scene2],
        )

        # Chapter 2: System Architecture & Execution Pipeline
        if lang == Language.HI:
            chap2_title = "सिस्टम आर्किटेक्चर और निष्पादन प्रवाह"
            chap2_summary = (
                "क्लाइंट, एपीआई गेटवे, पायथन बाइटकोड इंजन और मेमोरी एलोकेशन के बीच डेटा प्रवाह को समझें।"
            )
            scene3_title = "पायथन कॉम्प्रिहेंशन आर्किटेक्चर पाइपलाइन"
            scene3_narration = "यूज़र क्लाइंट से अनुरोध भेजता है। बैकएंड पार्सर इसे वैलिडेट करता है और पायथन वर्चुअल मशीन बाइटकोड को सीधे मेमोरी में निष्पादित करती है।"
            scene4_title = "बेंचमार्क और परफॉरमेंस सत्यापन"
            scene4_narration = "टर्मिनल बेंचमार्क दिखाता है कि लिस्ट कॉम्प्रिहेंशन सी-लेवल लूप अनुकूलन के कारण पारंपरिक लूप से लगभग पैंतीस प्रतिशत तेज़ है।"
        elif lang == Language.HINGLISH:
            chap2_title = "System Architecture & Execution Flow"
            chap2_summary = "Dekhiye Client, API Gateway, Python Bytecode Engine aur Memory Allocation ke beech request flow."
            scene3_title = "Pipeline Architecture: Client to Python VM"
            scene3_narration = "User client request bhejta hai, frontend aur backend API coordinate karte hain, aur Python engine optimize bytecode direct memory mein allocate karta hai."
            scene4_title = "Benchmark aur Performance Verification"
            scene4_narration = "Terminal benchmark verify karta hai ki list comprehension traditional loop ke comparison mein lagbhag 35% faster execute hoti hai."
        else:
            chap2_title = "System Architecture & Runtime Flow"
            chap2_summary = "Trace how request execution flows from User Client through the API layer to Python Bytecode Engine and Memory Store."
            scene3_title = "System Architecture: End-to-End Execution Flow"
            scene3_narration = "The developer submits code through the Frontend Client. The API Gateway forwards the AST to the Python Execution Engine, which allocates the pre-sized list directly in memory."
            scene4_title = "Performance Benchmark & Verification"
            scene4_narration = "Running a terminal benchmark reveals that list comprehensions execute up to thirty-five percent faster by avoiding repeated Python-level method lookup overhead."

        scene3_duration = max(estimate_duration_ms(scene3_narration, lang), 8000)
        scene4_duration = max(estimate_duration_ms(scene4_narration, lang), 6000)

        s3_third = scene3_duration // 3
        scene3 = Scene(
            scene_id="scene-03-architecture",
            title=scene3_title,
            narration_text=scene3_narration,
            visual=VisualSpec(
                scene_type=SceneType.DIAGRAM,
                mermaid_definition="graph LR\n  User[User Client] --> Frontend[Frontend React]\n  Frontend --> API[API Gateway / FastAPI]\n  API --> Engine[Python Bytecode Engine]\n  Engine --> Memory[(Pre-sized Memory Store)]",
                highlighted_terms=[
                    "User Client",
                    "Frontend React",
                    "API Gateway",
                    "Python Bytecode Engine",
                    "Memory Store",
                ],
                animation_style=AnimationStyle.FADE_SLIDE,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s3_third,
                    text="1. Client initiates request to API Gateway",
                ),
                Caption(
                    offset_ms=s3_third,
                    duration_ms=s3_third,
                    text="2. Backend validates & compiles AST into optimized Bytecode",
                ),
                Caption(
                    offset_ms=s3_third * 2,
                    duration_ms=scene3_duration - (s3_third * 2),
                    text="3. Memory buffer pre-allocated and response streamed back",
                ),
            ],
            uncertainty=UncertaintyLevel.NONE,
            uncertainty_note=None,
            grounding_category=GroundingCategory.INFERRED,
            what_to_verify=["Inspect AST compilation and bytecode dis.dis() output locally."],
        )

        s4_mid = scene4_duration // 2
        scene4 = Scene(
            scene_id="scene-04-benchmark",
            title=scene4_title,
            narration_text=scene4_narration,
            visual=VisualSpec(
                scene_type=SceneType.TERMINAL,
                command='python -m timeit -s "items=range(1000)" "[x * 2 for x in items]"',
                output="10000 loops, best of 5: 38.2 usec per loop (vs 58.7 usec with loop.append)",
                exit_code=0,
                highlighted_terms=["timeit", "38.2 usec", "35% faster", "LIST_APPEND"],
                animation_style=AnimationStyle.TYPEWRITER,
            ),
            captions=[
                Caption(
                    offset_ms=0,
                    duration_ms=s4_mid,
                    text=scene4_narration[: len(scene4_narration) // 2].strip(),
                ),
                Caption(
                    offset_ms=s4_mid,
                    duration_ms=scene4_duration - s4_mid,
                    text=scene4_narration[len(scene4_narration) // 2 :].strip(),
                ),
            ],
            uncertainty=UncertaintyLevel.LOW,
            uncertainty_note="Performance gain depends on Python runtime version (3.11+ specializing adaptive interpreter).",
            grounding_category=GroundingCategory.NEEDS_VERIFICATION,
            what_to_verify=["Run benchmark on target production machine and hardware."],
        )

        chapter2 = Chapter(
            chapter_id="chap-02-architecture",
            title=chap2_title,
            summary=chap2_summary,
            scenes=[scene3, scene4],
        )

        total_duration = scene1_duration + scene2_duration + scene3_duration + scene4_duration

        return Lesson(
            lesson_id="lesson-fixture-001",
            title=lesson_title,
            language=lang,
            content_type=request.content_type,
            total_estimated_duration_ms=total_duration,
            chapters=[chapter1, chapter2],
            glossary=glossary,
            verification_checklist=verification,
            gemini_model_version="gemini-3.8-flash",
            generated_at=datetime.now(UTC).isoformat(),
        )

    async def build(self, request: LessonRequest) -> Lesson:
        """Generate a lesson based on request parameters using Gemini or predefined fixture.

        Args:
            request: The validated lesson request payload.

        Returns:
            Constructed Lesson model.
        """
        if request.use_fixture:
            return self.build_fixture(request)

        template = jinja_env.get_template("lesson_prompt.j2")
        rendered_prompt = template.render(
            content=request.content,
            content_type=request.content_type.value,
            language=request.language.value,
            detail_level=request.detail_level.value,
        )

        return await self.gemini_client.generate_lesson(
            rendered_prompt, user_content=request.content
        )
