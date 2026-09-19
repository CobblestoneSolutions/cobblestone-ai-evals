# 01 — Support assistant (planned)

**Problem.** A shop's website chatbot failed for every visitor after a hosting move, and its
knowledge lived on a server where nobody could review it. When rebuilt, the hard part
wasn't answering — it was knowing when *not* to: allergen questions, complaints, and facts
the shop never published must go to a human, because a confident wrong answer is worse
than "let me have someone call you."

**This project** re-creates that assistant for a fictional shop (Maple Street Scoops) and
tests it against ~40 questions: lookups, menu, "not covered" facts, allergen and complaint
escalation, and prompt-injection attempts.
