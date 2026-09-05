# Specialist Accounting Glossary — English / Hindi / Gujarati

> **Purpose:** Accounting terminology in Hindi and Gujarati represents specialist commercial and statutory vocabulary. Machine translation often fails or distorts financial meaning (e.g. translating "Credit" as praise rather than "जमा / Samakalan"). This glossary establishes verified translations for the Urban Furniture Accounting System.
> **Binding Authority:** Every key in `src/messages/en.json`, `hi.json`, and `gu.json` must align with these terms.

---

## 1. Core Financial Concepts

| English Term | Hindi (देवनागरी) | Gujarati (ગુજરાતી) | Notes & Context |
|---|---|---|---|
| **Debit** | नामे (Debit) / विकलन | ઉધાર (Udhar) | Left side of ledger; asset/expense increase. |
| **Credit** | जमा (Credit) / समाकलन | જમા (Jama) | Right side of ledger; liability/equity/income increase. |
| **Chart of Accounts (CoA)** | खातों की सूची (Lekha Soochi) | ખાતાઓનું ચાર્ટ (Khataonu Chart) | Master list of all GL accounts. |
| **General Ledger** | सामान्य बहीखाता (Khata Vahi) | સામાન્ય ખાતાવહી (Samanya Khatavahi) | Primary record of all financial transactions. |
| **Journal Entry** | रोजनामचा प्रविष्टि (Roznamcha) | જર્નલ એન્ટ્રી / રોજમેળ નોંધ | Double-entry transaction record. |
| **Analytic Account** | विश्लेषणात्मक खाता | વિશ્લેષણાત્મક ખાતું | Cost center / project-level accounting. |
| **Balance Sheet** | तुलन पत्र (Tulan Patra) | સરવૈયું (Sarvaiyu) / બેલેન્સ શીટ | Statement of financial position (Assets = Liabilities + Equity). |
| **Profit & Loss (P&L)** | लाभ एवं हानि विवरण | નફા-નુકસાન પત્રક | Income statement (Revenue - Expenses = Net Profit). |
| **Trial Balance** | तलपट (Talpat) | કાચું સરવૈયું (Kachu Sarvaiyu) | Proof of debit/credit equality. |
| **Fiscal Year** | वित्तीय वर्ष | નાણાકીય વર્ષ (Nanakiy Varsh) | April 1 – March 31 accounting cycle. |

---

## 2. Account Classifications & Sub-types

| English Term | Hindi (देवनागरी) | Gujarati (ગુજરાતી) | Notes & Context |
|---|---|---|---|
| **Asset** | परिसंपत्ति / संपत्ति | સંપત્તિ / મિલકત (Milkat) | Economic resource owned. |
| **Liability** | दायित्व / देनदारी | જવાબદારી / દેવું (Devu) | Future financial sacrifice owed. |
| **Equity / Capital** | इक्विटी / पूंजी | મૂડી (Mudi) / માલિકી હિસ્સો | Residual interest in assets after liabilities. |
| **Income / Revenue** | आय / राजस्व | આવક (Aavak) | Revenue earned from operations. |
| **Expense** | व्यय / खर्च | ખર્ચ (Kharch) | Costs incurred to generate revenue. |
| **Debtors / Accounts Receivable** | देनदार / प्राप्य खाते | દેવાદારો / લેણાં ખાતા (Lena Khata) | Amounts due from customers. |
| **Creditors / Accounts Payable** | लेनदार / देय खाते | લેણદારો / દેવાં ખાતા (Deva Khata) | Amounts owed to vendors. |
| **Cash on Hand** | रोकड़ | રોકડ (Rokad) | Physical currency held. |
| **Bank Account** | बैंक खाता | બેંક ખાતું | Institutional bank deposit balance. |
| **Opening Balance Equity** | प्रारंभिक शेष इक्विटी | શરૂઆતની સિલક મૂડી | Account used to balance opening trial balance. |
| **Retained Earnings** | प्रतिधारित आय | સંચિત કમાણી | Cumulative undistributed profits. |

---

## 3. Commercial & Purchasing Documents

| English Term | Hindi (देवनागरी) | Gujarati (ગુજરાતી) | Notes & Context |
|---|---|---|---|
| **Purchase Order (PO)** | खरीद आदेश | ખરીદ ઓર્ડર (Kharid Order) | Non-posting vendor order contract. |
| **Vendor Bill** | विक्रेता बिल | વેપારી બિલ (Vepari Bill) | Financial liability document from vendor. |
| **Sales Order (SO)** | बिक्री आदेश | વેચાણ ઓર્ડર (Vechan Order) | Non-posting customer confirmation. |
| **Customer Invoice** | ग्राहक चालान / बीजक | ગ્રાહક ઇનવોઇસ / બિલ | Financial receivable document to customer. |
| **Payment** | भुगतान | ચુકવણી (Chukvani) | Settlement of receivable or payable. |
| **Payment Allocation** | भुगतान आवंटन | ચુકવણી ફાળવણી | Linking a payment to specific invoices/bills. |
| **Untaxed Amount** | कर-पूर्व राशि | કર વિનાની રકમ | Subtotal before taxes. |
| **Tax Amount** | कर राशि | કરની રકમ | Computed tax value. |
| **Total Amount** | कुल राशि | કુલ રકમ | Subtotal + taxes. |
| **Amount Due** | देय शेष | બાકી રકમ | Remaining unpaid balance. |

---

## 4. Lifecycle Statuses

| English Term | Hindi (देवनागरी) | Gujarati (ગુજરાતી) | Notes & Context |
|---|---|---|---|
| **Draft** | मसौदा | ડ્રાફ્ટ / કાચું | Unposted, fully editable. |
| **Posted** | प्रविष्ट / दर्ज | નોંધાયેલ (Nondhayel) / પાકું | Formally committed to GL, non-editable. |
| **Cancelled** | रद्द | રદ કરેલ (Rad Karel) | Voided transaction. |
| **Unpaid** | अदत्त / बकाया | બાકી (Baki) | Zero payments allocated. |
| **Partially Paid** | आंशिक भुगतान | અંશતઃ ચૂકવેલ | Partial payment allocated. |
| **Paid** | पूर्ण भुगतान | ચૂકવેલ (Chukvel) | Fully settled. |
| **Overdue** | अतिदेय / मियाद बीती | મુદત વીતેલી | Due date elapsed without settlement. |
| **Active** | सक्रिय | સક્રિય (Sakriya) | Master record in active use. |
| **Archived / Inactive** | संग्रहीत / निष्क्रिय | સંગ્રહિત / નિષ્ક્રિય | Master record archived from daily selections. |

---

## 5. Domain Flags & Specific Decisions

- **Analytic Account**: Avoid generic "Analysis" (विश्लेषण / વિશ્લેષણ); use "विश्लेषणात्मक खाता" / "વિશ્લેષણાત્મક ખાતું" to represent financial cost-center tracking.
- **Narration**: Use "विवरण" / "વિગત" for journal entry explanations rather than literal narration.
- **Posting**: Use "प्रविष्ट करें" / "ખાતાવહીમાં નોંધો" for the act of ledger posting.
