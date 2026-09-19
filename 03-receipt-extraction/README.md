# 03 — Receipt extraction with self-check (planned)

**Problem.** Supplier receipts arrive as phone photos. Typing them in is slow; a model that
reads them will sometimes misread a digit, and a wrong total silently corrupts the books.

**This project** extracts vendor, date, line items, tax and total, then runs a second pass that
checks the output against itself (line items sum to subtotal, subtotal + tax = total, the date
is plausible). Anything that fails goes to a human instead of being saved. All receipts are synthetic.
