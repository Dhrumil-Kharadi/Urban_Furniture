/**
 * scripts/generate-i18n-phase4.js
 * Merges Phase 4 accounting namespaces into en.json, hi.json, and gu.json
 * guaranteeing 100% key-tree parity across all three locale dictionaries.
 */

const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'src', 'messages');

// 1. ENGLISH NAMESPACES
const enNamespaces = {
  common: {
    actions: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      archive: "Archive",
      restore: "Restore",
      create: "Create",
      new: "New",
      edit: "Edit",
      view: "View",
      print: "Print",
      download: "Download",
      export: "Export",
      import: "Import",
      confirm: "Confirm",
      close: "Close",
      post: "Post Entry",
      reset: "Reset",
      filter: "Filter",
      clearFilters: "Clear Filters",
      search: "Search",
      searchPlaceholder: "Search records…",
      refresh: "Refresh",
      back: "Back",
      retry: "Retry",
      submit: "Submit",
      submitting: "Submitting…",
      saving: "Saving…",
      loading: "Loading…",
      payNow: "Pay Now",
      allocate: "Allocate"
    },
    status: {
      draft: "Draft",
      posted: "Posted",
      cancelled: "Cancelled",
      unpaid: "Unpaid",
      partiallyPaid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
      active: "Active",
      inactive: "Inactive",
      archived: "Archived",
      open: "Open",
      closed: "Closed",
      pending: "Pending",
      confirmed: "Confirmed"
    },
    table: {
      loading: "Loading records…",
      empty: "No records found.",
      emptyFiltered: "No records match your filters.",
      showing: "Showing {start} to {end} of {total} records",
      rowsPerPage: "Rows per page",
      actions: "Actions",
      selectAll: "Select All"
    },
    validation: {
      required: "This field is required",
      invalidEmail: "Invalid email address",
      invalidNumber: "Must be a valid number",
      invalidDate: "Must be a valid date",
      positiveNumber: "Must be greater than zero",
      nonNegative: "Cannot be negative"
    },
    toast: {
      success: "Operation completed successfully",
      error: "An error occurred",
      saved: "Changes saved successfully",
      deleted: "Record deleted",
      created: "Record created successfully"
    }
  },
  contacts: {
    title: "Contacts",
    subtitle: "Manage customers, vendors, and business partners",
    createContact: "New Contact",
    editContact: "Edit Contact",
    types: {
      customer: "Customer",
      vendor: "Vendor",
      both: "Customer & Vendor"
    },
    fields: {
      name: "Contact Name",
      type: "Contact Type",
      email: "Email Address",
      mobile: "Mobile Number",
      address: "Street Address",
      city: "City",
      state: "State",
      pincode: "PIN / Postal Code",
      taxId: "Tax / GSTIN ID",
      portalAccess: "Allow Portal Access",
      status: "Status"
    },
    tabs: {
      details: "Details",
      invoices: "Customer Invoices",
      bills: "Vendor Bills",
      payments: "Payments & Ledger"
    }
  },
  products: {
    title: "Products",
    subtitle: "Items and services for sales and purchases",
    createProduct: "New Product",
    editProduct: "Edit Product",
    types: {
      goods: "Physical Goods",
      service: "Service"
    },
    fields: {
      name: "Product Name",
      sku: "SKU / Code",
      type: "Product Type",
      category: "Category",
      salesPrice: "Sales Price",
      costPrice: "Cost Price",
      salesTax: "Sales Tax",
      purchaseTax: "Purchase Tax",
      incomeAccount: "Income Account",
      expenseAccount: "Expense Account",
      description: "Description",
      status: "Status"
    },
    categories: {
      title: "Product Categories",
      createCategory: "New Category",
      name: "Category Name",
      parent: "Parent Category"
    }
  },
  accounts: {
    title: "Chart of Accounts",
    subtitle: "General Ledger account master for double-entry bookkeeping",
    createAccount: "New Account",
    editAccount: "Edit Account",
    types: {
      asset: "Asset",
      liability: "Liability",
      equity: "Equity",
      income: "Income",
      expense: "Expense"
    },
    fields: {
      code: "Account Code",
      name: "Account Name",
      type: "Account Classification",
      parent: "Parent Account",
      openingBalance: "Opening Balance",
      currentBalance: "Current Balance",
      isSystem: "System Account",
      status: "Status"
    }
  },
  journals: {
    title: "Journals",
    subtitle: "Accounting journals to segregate transactional entries",
    createJournal: "New Journal",
    editJournal: "Edit Journal",
    types: {
      sales: "Sales Journal",
      purchase: "Purchase Journal",
      bank: "Bank Journal",
      cash: "Cash Journal",
      general: "Miscellaneous Journal"
    },
    fields: {
      code: "Journal Code",
      name: "Journal Name",
      type: "Type",
      defaultDebitAccount: "Default Debit Account",
      defaultCreditAccount: "Default Credit Account",
      sequencePrefix: "Sequence Prefix"
    }
  },
  journalEntries: {
    title: "Journal Entries",
    subtitle: "Double-entry general ledger transactions",
    createEntry: "New Journal Entry",
    editEntry: "Edit Entry",
    fields: {
      entryNumber: "Entry #",
      date: "Date",
      journal: "Journal",
      reference: "Reference",
      narration: "Narration / Note",
      status: "Status",
      account: "Account",
      partner: "Partner / Contact",
      debit: "Debit (₹)",
      credit: "Credit (₹)",
      totalDebit: "Total Debit",
      totalCredit: "Total Credit",
      unbalanced: "Unbalanced Entry (Difference: {diff})",
      balanced: "Balanced Entry"
    },
    actions: {
      postToLedger: "Post to Ledger",
      reverse: "Reverse Entry"
    }
  },
  analyticAccounts: {
    title: "Analytic Accounts",
    subtitle: "Cost centers and projects for managerial accounting",
    createAccount: "New Analytic Account",
    editAccount: "Edit Analytic Account",
    fields: {
      name: "Analytic Account Name",
      code: "Code",
      department: "Department / Project",
      budget: "Allocated Budget",
      status: "Status"
    }
  },
  budgets: {
    title: "Budgets",
    subtitle: "Financial plan and variance tracking by analytic account",
    createBudget: "New Budget",
    editBudget: "Edit Budget",
    fields: {
      name: "Budget Name",
      periodStart: "Start Date",
      periodEnd: "End Date",
      analyticAccount: "Analytic Account",
      responsible: "Responsible Manager",
      plannedAmount: "Planned Amount",
      actualAmount: "Actual Amount",
      variance: "Variance",
      consumption: "Consumption (%)"
    }
  },
  taxes: {
    title: "Tax Rates",
    subtitle: "Sales and purchase tax definitions",
    createTax: "New Tax",
    editTax: "Edit Tax",
    scopes: {
      sales: "Sales Only",
      purchase: "Purchase Only",
      both: "Sales & Purchase"
    },
    types: {
      percentage: "Percentage (%)",
      fixed: "Fixed Amount"
    },
    fields: {
      name: "Tax Name",
      rate: "Rate (%)",
      scope: "Scope",
      computation: "Computation",
      collectedAccount: "Tax Output Account (Payable)",
      paidAccount: "Tax Input Account (Credit)",
      status: "Status"
    }
  },
  purchases: {
    title: "Purchase Orders",
    subtitle: "Procurement orders and vendor confirmations",
    createOrder: "New Purchase Order",
    vendorBillsTitle: "Vendor Bills",
    createBill: "New Vendor Bill",
    fields: {
      orderNumber: "PO Number",
      billNumber: "Bill Number",
      vendor: "Vendor",
      orderDate: "Order Date",
      billDate: "Bill Date",
      dueDate: "Due Date",
      reference: "Vendor Reference",
      untaxedTotal: "Untaxed Amount",
      taxTotal: "Taxes",
      totalAmount: "Total Amount",
      paidAmount: "Paid Amount",
      amountDue: "Amount Due",
      notes: "Terms & Conditions"
    },
    lines: {
      product: "Product / Item",
      description: "Description",
      account: "Expense Account",
      quantity: "Quantity",
      unitPrice: "Unit Cost",
      tax: "Tax",
      amount: "Line Total",
      addLine: "Add an Item",
      removeLine: "Remove"
    }
  },
  sales: {
    title: "Sales Orders",
    subtitle: "Customer orders and commercial quotations",
    createOrder: "New Sales Order",
    invoicesTitle: "Customer Invoices",
    createInvoice: "New Customer Invoice",
    fields: {
      orderNumber: "SO Number",
      invoiceNumber: "Invoice Number",
      customer: "Customer",
      orderDate: "Order Date",
      invoiceDate: "Invoice Date",
      dueDate: "Due Date",
      reference: "Payment Reference",
      untaxedTotal: "Untaxed Amount",
      taxTotal: "Taxes",
      totalAmount: "Total Amount",
      paidAmount: "Paid Amount",
      amountDue: "Amount Due",
      notes: "Payment Terms"
    },
    lines: {
      product: "Product / Item",
      description: "Description",
      account: "Income Account",
      quantity: "Quantity",
      unitPrice: "Unit Price",
      tax: "Tax",
      amount: "Line Total",
      addLine: "Add an Item",
      removeLine: "Remove"
    }
  },
  payments: {
    title: "Payments",
    subtitle: "Customer receipts and vendor disbursements",
    createPayment: "Record Payment",
    directions: {
      inbound: "Customer Receipt (Inbound)",
      outbound: "Vendor Disbursement (Outbound)"
    },
    methods: {
      cash: "Cash",
      bank: "Bank Transfer / NEFT",
      card: "Card Payment",
      cheque: "Cheque"
    },
    fields: {
      paymentNumber: "Payment #",
      contact: "Partner / Contact",
      date: "Payment Date",
      amount: "Amount Received / Paid",
      direction: "Payment Type",
      method: "Payment Method",
      journal: "Payment Journal",
      reference: "Transaction / Cheque #",
      allocated: "Allocated Amount",
      unallocated: "Unallocated Balance",
      status: "Status"
    },
    allocation: {
      title: "Invoice / Bill Allocation",
      document: "Document #",
      originalAmount: "Total Amount",
      openBalance: "Outstanding",
      allocatedNow: "Allocate This Payment"
    }
  },
  reports: {
    title: "Financial Reports",
    subtitle: "Statutory statements and managerial financial summaries",
    balanceSheet: {
      title: "Balance Sheet",
      subtitle: "Statement of Financial Position as of date",
      assets: "Assets",
      liabilities: "Liabilities",
      equity: "Equity & Retained Earnings",
      totalAssets: "Total Assets",
      totalLiabilitiesEquity: "Total Liabilities & Equity",
      currentYearEarnings: "Unallocated Current Year Earnings"
    },
    profitLoss: {
      title: "Profit and Loss",
      subtitle: "Income statement for selected reporting period",
      operatingIncome: "Operating Revenue",
      costOfSales: "Cost of Goods Sold",
      grossProfit: "Gross Profit",
      operatingExpenses: "Operating Expenses",
      netProfit: "Net Profit / (Loss)"
    },
    budgetReport: {
      title: "Budget vs. Actuals",
      subtitle: "Analytical variance tracking across cost centers",
      account: "Analytic Cost Center",
      planned: "Planned Spend",
      actual: "Actual Spend",
      variance: "Variance (Savings / Overrun)"
    },
    toolbar: {
      asOfDate: "As of Date",
      dateRange: "Reporting Period",
      thisMonth: "This Month",
      thisQuarter: "This Quarter",
      thisFY: "This Financial Year",
      custom: "Custom Range"
    }
  },
  portal: {
    title: "Partner Portal",
    welcome: "Welcome, {name}",
    subtitle: "View and pay invoices, review account statements",
    kpis: {
      outstanding: "Total Outstanding",
      overdue: "Overdue Amount",
      paidThisYear: "Paid This Financial Year"
    },
    invoices: {
      title: "Your Invoices",
      empty: "You have no invoices raised."
    },
    bills: {
      title: "Your Bills",
      empty: "You have no vendor bills."
    },
    pay: {
      payInvoice: "Pay Invoice {number}",
      amountPrompt: "Amount to pay",
      cardPlaceholder: "Debit / Credit Card (Gateway Mock)",
      proceed: "Proceed to Payment"
    }
  },
  users: {
    title: "Team Members",
    subtitle: "Manage access, invite colleagues, and configure roles",
    inviteUser: "Invite Team Member",
    fields: {
      name: "Full Name",
      email: "Email Address",
      role: "Assigned Role",
      status: "Account Status",
      invitedAt: "Invited Date"
    },
    roles: {
      admin: "Business Owner (Admin)",
      manager: "Accountant (Manager)",
      user: "Contact / Customer (User)"
    },
    dialog: {
      inviteTitle: "Invite New Team Member",
      inviteDesc: "An email invitation with a secure single-use link will be sent to the recipient to set their password.",
      sendInvite: "Send Invitation",
      sending: "Sending…"
    },
    status: {
      active: "Active",
      invited: "Invited (Pending Set Password)",
      deactivated: "Deactivated"
    }
  }
};

// 2. HINDI NAMESPACES (Aligned with GLOSSARY.md)
const hiNamespaces = {
  common: {
    actions: {
      save: "सुरक्षित करें",
      cancel: "रद्द करें",
      delete: "हटाएं",
      archive: "संग्रहीत करें",
      restore: "पुनर्स्थापित करें",
      create: "नया बनाएं",
      new: "नया",
      edit: "संपादित करें",
      view: "देखें",
      print: "प्रिंट करें",
      download: "डाउनलोड करें",
      export: "निर्यात (Export)",
      import: "आयात (Import)",
      confirm: "पुष्टि करें",
      close: "बंद करें",
      post: "प्रविष्ट करें (Post)",
      reset: "रीसेट करें",
      filter: "फ़िल्टर",
      clearFilters: "फ़िल्टर साफ़ करें",
      search: "खोजें",
      searchPlaceholder: "रिकॉर्ड खोजें…",
      refresh: "ताज़ा करें",
      back: "वापस",
      retry: "पुनः प्रयास करें",
      submit: "जमा करें",
      submitting: "जमा हो रहा है…",
      saving: "सुरक्षित हो रहा है…",
      loading: "लोड हो रहा है…",
      payNow: "अभी भुगतान करें",
      allocate: "आवंटित करें"
    },
    status: {
      draft: "मसौदा (Draft)",
      posted: "प्रविष्ट (Posted)",
      cancelled: "रद्द (Cancelled)",
      unpaid: "अदत्त (Unpaid)",
      partiallyPaid: "आंशिक भुगतान",
      paid: "पूर्ण भुगतान (Paid)",
      overdue: "अतिदेय (Overdue)",
      active: "सक्रिय",
      inactive: "निष्क्रिय",
      archived: "संग्रहीत",
      open: "खुला",
      closed: "बंद",
      pending: "लंबित",
      confirmed: "पुष्टि की गई"
    },
    table: {
      loading: "रिकॉर्ड लोड हो रहे हैं…",
      empty: "कोई रिकॉर्ड नहीं मिला।",
      emptyFiltered: "फ़िल्टर से मेल खाता कोई रिकॉर्ड नहीं मिला।",
      showing: "{total} में से {start} से {end} रिकॉर्ड प्रदर्शित",
      rowsPerPage: "प्रति पृष्ठ पंक्तियाँ",
      actions: "कार्रवाई",
      selectAll: "सभी चुनें"
    },
    validation: {
      required: "यह फ़ील्ड आवश्यक है",
      invalidEmail: "अमान्य ईमेल पता",
      invalidNumber: "वैध संख्या दर्ज करें",
      invalidDate: "वैध तिथि दर्ज करें",
      positiveNumber: "संख्या शून्य से अधिक होनी चाहिए",
      nonNegative: "ऋणात्मक नहीं हो सकता"
    },
    toast: {
      success: "कार्य सफलतापूर्वक संपन्न हुआ",
      error: "एक त्रुटि उत्पन्न हुई",
      saved: "परिवर्तन सहेजे गए",
      deleted: "रिकॉर्ड हटा दिया गया",
      created: "रिकॉर्ड सफलतापूर्वक बनाया गया"
    }
  },
  contacts: {
    title: "संपर्क (Contacts)",
    subtitle: "ग्राहकों, विक्रेताओं और व्यावसायिक भागीदारों का प्रबंधन",
    createContact: "नया संपर्क",
    editContact: "संपर्क संपादित करें",
    types: {
      customer: "ग्राहक (Customer)",
      vendor: "विक्रेता (Vendor)",
      both: "ग्राहक एवं विक्रेता दोनों"
    },
    fields: {
      name: "संपर्क नाम",
      type: "संपर्क प्रकार",
      email: "ईमेल पता",
      mobile: "मोबाइल नंबर",
      address: "सड़क / पता",
      city: "शहर",
      state: "राज्य",
      pincode: "पिन कोड",
      taxId: "जीएसटीआईएन / कर पहचान",
      portalAccess: "पोर्टल एक्सेस की अनुमति दें",
      status: "स्थिति"
    },
    tabs: {
      details: "विवरण",
      invoices: "ग्राहक चालान (Invoices)",
      bills: "विक्रेता बिल (Bills)",
      payments: "भुगतान एवं खाता बही"
    }
  },
  products: {
    title: "उत्पाद (Products)",
    subtitle: "बिक्री और खरीद के लिए वस्तुएं और सेवाएं",
    createProduct: "नया उत्पाद",
    editProduct: "उत्पाद संपादित करें",
    types: {
      goods: "भौतिक वस्तुएं (Goods)",
      service: "सेवा (Service)"
    },
    fields: {
      name: "उत्पाद का नाम",
      sku: "एसकेयू / कोड",
      type: "उत्पाद प्रकार",
      category: "श्रेणी (Category)",
      salesPrice: "बिक्री मूल्य",
      costPrice: "लागत मूल्य",
      salesTax: "बिक्री कर",
      purchaseTax: "खरीद कर",
      incomeAccount: "आय खाता (Income Account)",
      expenseAccount: "व्यय खाता (Expense Account)",
      description: "विवरण",
      status: "स्थिति"
    },
    categories: {
      title: "उत्पाद श्रेणियां",
      createCategory: "नई श्रेणी",
      name: "श्रेणी का नाम",
      parent: "मूल श्रेणी (Parent Category)"
    }
  },
  accounts: {
    title: "खातों की सूची (Chart of Accounts)",
    subtitle: "दोहरी प्रविष्टि बहीखाता पद्धति के लिए खाता बही",
    createAccount: "नया खाता",
    editAccount: "खाता संपादित करें",
    types: {
      asset: "परिसंपत्ति (Asset)",
      liability: "दायित्व (Liability)",
      equity: "पूंजी / इक्विटी (Equity)",
      income: "आय (Income)",
      expense: "व्यय (Expense)"
    },
    fields: {
      code: "खाता कोड",
      name: "खाता नाम",
      type: "खाता वर्गीकरण",
      parent: "मूल खाता",
      openingBalance: "प्रारंभिक शेष (Opening Balance)",
      currentBalance: "वर्तमान शेष",
      isSystem: "प्रणाली खाता (System Account)",
      status: "स्थिति"
    }
  },
  journals: {
    title: "रोजनामचे (Journals)",
    subtitle: "लेन-देन संबंधी प्रविष्टियों को वर्गीकृत करने के रोजनामचे",
    createJournal: "नया रोजनामचा",
    editJournal: "रोजनामचा संपादित करें",
    types: {
      sales: "बिक्री रोजनामचा (Sales Journal)",
      purchase: "खरीद रोजनामचा (Purchase Journal)",
      bank: "बैंक रोजनामचा (Bank Journal)",
      cash: "रोकड़ रोजनामचा (Cash Journal)",
      general: "विविध रोजनामचा (General Journal)"
    },
    fields: {
      code: "रोजनामचा कोड",
      name: "रोजनामचा का नाम",
      type: "प्रकार",
      defaultDebitAccount: "डिफ़ॉल्ट नामे खाता (Debit Account)",
      defaultCreditAccount: "डिफ़ॉल्ट जमा खाता (Credit Account)",
      sequencePrefix: "अनुक्रम उपसर्ग (Prefix)"
    }
  },
  journalEntries: {
    title: "रोजनामचा प्रविष्टियां (Journal Entries)",
    subtitle: "दोहरी प्रविष्टि सामान्य बहीखाता लेन-देन",
    createEntry: "नई रोजनामचा प्रविष्टि",
    editEntry: "प्रविष्टि संपादित करें",
    fields: {
      entryNumber: "प्रविष्टि संख्या #",
      date: "दिनांक",
      journal: "रोजनामचा",
      reference: "संदर्भ",
      narration: "विवरण / नोट",
      status: "स्थिति",
      account: "खाता",
      partner: "भागीदार / संपर्क",
      debit: "नामे / डेबिट (₹)",
      credit: "जमा / क्रेडिट (₹)",
      totalDebit: "कुल नामे",
      totalCredit: "कुल जमा",
      unbalanced: "असंतुलित प्रविष्टि (अंतर: {diff})",
      balanced: "संतुलित प्रविष्टि"
    },
    actions: {
      postToLedger: "खाताबही में दर्ज करें (Post)",
      reverse: "प्रविष्टि उलटें (Reverse)"
    }
  },
  analyticAccounts: {
    title: "विश्लेषणात्मक खाते (Analytic Accounts)",
    subtitle: "प्रबंधकीय लेखांकन के लिए लागत केंद्र और परियोजनाएं",
    createAccount: "नया विश्लेषणात्मक खाता",
    editAccount: "विश्लेषणात्मक खाता संपादित करें",
    fields: {
      name: "विश्लेषणात्मक खाते का नाम",
      code: "कोड",
      department: "विभाग / परियोजना",
      budget: "आवंटित बजट",
      status: "स्थिति"
    }
  },
  budgets: {
    title: "बजट (Budgets)",
    subtitle: "विश्लेषणात्मक खाते द्वारा वित्तीय योजना और विचरण ट्रैकिंग",
    createBudget: "नया बजट",
    editBudget: "बजट संपादित करें",
    fields: {
      name: "बजट का नाम",
      periodStart: "प्रारंभ तिथि",
      periodEnd: "समाप्ति तिथि",
      analyticAccount: "विश्लेषणात्मक खाता",
      responsible: "जिम्मेदार प्रबंधक",
      plannedAmount: "नियोजित राशि (Planned)",
      actualAmount: "वास्तविक राशि (Actual)",
      variance: "विचरण (Variance)",
      consumption: "खपत (%)"
    }
  },
  taxes: {
    title: "कर दरें (Tax Rates)",
    subtitle: "बिक्री और खरीद कर परिभाषाएं",
    createTax: "नया कर",
    editTax: "कर संपादित करें",
    scopes: {
      sales: "केवल बिक्री",
      purchase: "केवल खरीद",
      both: "बिक्री एवं खरीद दोनों"
    },
    types: {
      percentage: "प्रतिशत (%)",
      fixed: "निश्चित राशि"
    },
    fields: {
      name: "कर का नाम",
      rate: "दर (%)",
      scope: "दायरा (Scope)",
      computation: "गणना प्रकार",
      collectedAccount: "निर्गत कर खाता (देय)",
      paidAccount: "आगत कर खाता (क्रेडिट)",
      status: "स्थिति"
    }
  },
  purchases: {
    title: "खरीद आदेश (Purchase Orders)",
    subtitle: "खरीद आदेश और विक्रेता पुष्टिकरण",
    createOrder: "नया खरीद आदेश",
    vendorBillsTitle: "विक्रेता बिल (Vendor Bills)",
    createBill: "नया विक्रेता बिल",
    fields: {
      orderNumber: "पीओ संख्या #",
      billNumber: "बिल संख्या #",
      vendor: "विक्रेता (Vendor)",
      orderDate: "आदेश तिथि",
      billDate: "बिल तिथि",
      dueDate: "देय तिथि",
      reference: "विक्रेता संदर्भ",
      untaxedTotal: "कर-पूर्व कुल राशि",
      taxTotal: "कुल कर",
      totalAmount: "कुल राशि",
      paidAmount: "भुगतान की गई राशि",
      amountDue: "देय शेष",
      notes: "नियम एवं शर्तें"
    },
    lines: {
      product: "उत्पाद / वस्तु",
      description: "विवरण",
      account: "व्यय खाता (Expense Account)",
      quantity: "मात्रा",
      unitPrice: "इकाई लागत",
      tax: "कर",
      amount: "पंक्ति योग",
      addLine: "वस्तु जोड़ें",
      removeLine: "हटाएं"
    }
  },
  sales: {
    title: "बिक्री आदेश (Sales Orders)",
    subtitle: "ग्राहक आदेश और वाणिज्यिक प्रस्ताव",
    createOrder: "नया बिक्री आदेश",
    invoicesTitle: "ग्राहक चालान (Customer Invoices)",
    createInvoice: "नया ग्राहक चालान",
    fields: {
      orderNumber: "एसओ संख्या #",
      invoiceNumber: "चालान संख्या #",
      customer: "ग्राहक (Customer)",
      orderDate: "आदेश तिथि",
      invoiceDate: "चालान तिथि",
      dueDate: "देय तिथि",
      reference: "भुगतान संदर्भ",
      untaxedTotal: "कर-पूर्व कुल राशि",
      taxTotal: "कुल कर",
      totalAmount: "कुल राशि",
      paidAmount: "प्राप्त राशि",
      amountDue: "देय शेष",
      notes: "भुगतान की शर्तें"
    },
    lines: {
      product: "उत्पाद / वस्तु",
      description: "विवरण",
      account: "आय खाता (Income Account)",
      quantity: "मात्रा",
      unitPrice: "इकाई मूल्य",
      tax: "कर",
      amount: "पंक्ति योग",
      addLine: "वस्तु जोड़ें",
      removeLine: "हटाएं"
    }
  },
  payments: {
    title: "भुगतान (Payments)",
    subtitle: "ग्राहक प्राप्तियां और विक्रेता संवितरण",
    createPayment: "भुगतान दर्ज करें",
    directions: {
      inbound: "ग्राहक प्राप्ति (Inbound)",
      outbound: "विक्रेता संवितरण (Outbound)"
    },
    methods: {
      cash: "रोकड़ (Cash)",
      bank: "बैंक अंतरण (NEFT/RTGS)",
      card: "कार्ड भुगतान",
      cheque: "चेक"
    },
    fields: {
      paymentNumber: "भुगतान #",
      contact: "भागीदार / संपर्क",
      date: "भुगतान तिथि",
      amount: "प्राप्त / प्रदत्त राशि",
      direction: "भुगतान प्रकार",
      method: "भुगतान विधि",
      journal: "भुगतान रोजनामचा",
      reference: "लेन-देन / चेक संख्या",
      allocated: "आवंटित राशि",
      unallocated: "अनावंटित शेष",
      status: "स्थिति"
    },
    allocation: {
      title: "चालान / बिल आवंटन",
      document: "दस्तावेज़ संख्या #",
      originalAmount: "कुल राशि",
      openBalance: "बकाया शेष",
      allocatedNow: "इस भुगतान को आवंटित करें"
    }
  },
  reports: {
    title: "वित्तीय विवरण (Reports)",
    subtitle: "सांविधिक विवरण और प्रबंधकीय वित्तीय सारांश",
    balanceSheet: {
      title: "तुलन पत्र (Balance Sheet)",
      subtitle: "निर्दिष्ट तिथि पर वित्तीय स्थिति का विवरण",
      assets: "संपत्तियां (Assets)",
      liabilities: "देनदारियां (Liabilities)",
      equity: "पूंजी एवं संचित आय (Equity)",
      totalAssets: "कुल परिसंपत्तियां",
      totalLiabilitiesEquity: "कुल देनदारियां एवं पूंजी",
      currentYearEarnings: "चालू वर्ष की अनावंटित आय"
    },
    profitLoss: {
      title: "लाभ एवं हानि विवरण (Profit & Loss)",
      subtitle: "चयनित रिपोर्टिंग अवधि के लिए आय विवरण",
      operatingIncome: "परिचालन आय (Operating Revenue)",
      costOfSales: "बिक्री की लागत (COGS)",
      grossProfit: "सकल लाभ (Gross Profit)",
      operatingExpenses: "परिचालन व्यय (Operating Expenses)",
      netProfit: "शुद्ध लाभ / (हानि)"
    },
    budgetReport: {
      title: "बजट बनाम वास्तविक (Budget vs Actuals)",
      subtitle: "लागत केंद्रों में विश्लेषणात्मक विचरण ट्रैकिंग",
      account: "लागत केंद्र (Cost Center)",
      planned: "नियोजित व्यय",
      actual: "वास्तविक व्यय",
      variance: "विचरण (बचत / अधिक व्यय)"
    },
    toolbar: {
      asOfDate: "इस तिथि तक (As of Date)",
      dateRange: "रिपोर्टिंग अवधि",
      thisMonth: "इस महीने",
      thisQuarter: "इस तिमाही",
      thisFY: "इस वित्तीय वर्ष",
      custom: "कस्टम अवधि"
    }
  },
  portal: {
    title: "पार्टनर पोर्टल (Partner Portal)",
    welcome: "स्वागत है, {name}",
    subtitle: "चालान देखें और भुगतान करें, खाता विवरण की समीक्षा करें",
    kpis: {
      outstanding: "कुल बकाया राशि",
      overdue: "अतिदेय राशि",
      paidThisYear: "इस वित्तीय वर्ष में भुगतान किया गया"
    },
    invoices: {
      title: "आपके चालान",
      empty: "आपके नाम पर कोई चालान जारी नहीं किया गया है।"
    },
    bills: {
      title: "आपके विक्रेता बिल",
      empty: "कोई विक्रेता बिल उपलब्ध नहीं है।"
    },
    pay: {
      payInvoice: "चालान संख्या {number} का भुगतान करें",
      amountPrompt: "भुगतान की जाने वाली राशि",
      cardPlaceholder: "डेबिट / क्रेडिट कार्ड",
      proceed: "भुगतान के लिए आगे बढ़ें"
    }
  },
  users: {
    title: "टीम के सदस्य (Team Members)",
    subtitle: "पहुंच प्रबंधित करें, सहयोगियों को आमंत्रित करें और भूमिकाएं तय करें",
    inviteUser: "टीम सदस्य को आमंत्रित करें",
    fields: {
      name: "पूरा नाम",
      email: "ईमेल पता",
      role: "आवंटित भूमिका",
      status: "खाता स्थिति",
      invitedAt: "आमंत्रण तिथि"
    },
    roles: {
      admin: "व्यवसाय स्वामी (Admin)",
      manager: "लेखाकार (Manager)",
      user: "संपर्क / ग्राहक (User)"
    },
    dialog: {
      inviteTitle: "नए टीम सदस्य को आमंत्रित करें",
      inviteDesc: "पासवर्ड सेट करने के लिए प्राप्तकर्ता को एक सुरक्षित लिंक युक्त ईमेल आमंत्रण भेजा जाएगा।",
      sendInvite: "आमंत्रण भेजें",
      sending: "भेजा जा रहा है…"
    },
    status: {
      active: "सक्रिय",
      invited: "आमंत्रित (पासवर्ड लंबित)",
      deactivated: "निष्क्रिय"
    }
  }
};

// 3. GUJARATI NAMESPACES (Aligned with GLOSSARY.md)
const guNamespaces = {
  common: {
    actions: {
      save: "સાચવો",
      cancel: "રદ કરો",
      delete: "કાઢી નાખો",
      archive: "સંગ્રહિત કરો",
      restore: "પુનઃસ્થાપિત કરો",
      create: "નવું બનાવો",
      new: "નવું",
      edit: "ફેરફાર કરો",
      view: "જુઓ",
      print: "પ્રિન્ટ કરો",
      download: "ડાઉનલોડ કરો",
      export: "નિકાસ કરો (Export)",
      import: "આયાત કરો (Import)",
      confirm: "ખાતરી કરો",
      close: "બંધ કરો",
      post: "નોંધ કરો (Post)",
      reset: "રીસેટ કરો",
      filter: "ફિલ્ટર",
      clearFilters: "ફિલ્ટર સાફ કરો",
      search: "શોધો",
      searchPlaceholder: "રેકોર્ડ શોધો…",
      refresh: "તાજું કરો",
      back: "પાછા જાઓ",
      retry: "ફરી પ્રયાસ કરો",
      submit: "સબમિટ કરો",
      submitting: "સબમિટ થઈ રહ્યું છે…",
      saving: "સાચવી રહ્યું છે…",
      loading: "લોડ થઈ રહ્યું છે…",
      payNow: "હમણાં ચૂકવો",
      allocate: "ફાળવો"
    },
    status: {
      draft: "કાચું (Draft)",
      posted: "નોંધાયેલ (Posted)",
      cancelled: "રદ કરેલ (Cancelled)",
      unpaid: "બાકી (Unpaid)",
      partiallyPaid: "અંશતઃ ચૂકવેલ",
      paid: "ચૂકવેલ (Paid)",
      overdue: "મુદત વીતેલી (Overdue)",
      active: "સક્રિય",
      inactive: "નિષ્ક્રિય",
      archived: "સંગ્રહિત",
      open: "ખુલ્લું",
      closed: "બંધ",
      pending: "બાકી / પેન્ડિંગ",
      confirmed: "પુષ્ટિ થયેલ"
    },
    table: {
      loading: "રેકોર્ડ લોડ થઈ રહ્યા છે…",
      empty: "કોઈ રેકોર્ડ મળ્યા નથી.",
      emptyFiltered: "ફિલ્ટર સાથે મેળ ખાતા કોઈ રેકોર્ડ નથી.",
      showing: "{total} માંથી {start} થી {end} રેકોર્ડ દર્શાવે છે",
      rowsPerPage: "પૃષ્ઠ દીઠ પંક્તિઓ",
      actions: "ક્રિયાઓ",
      selectAll: "બધા પસંદ કરો"
    },
    validation: {
      required: "આ વિગત જરૂરી છે",
      invalidEmail: "અમાન્ય ઇમેઇલ સરનામું",
      invalidNumber: "માન્ય સંખ્યા દાખલ કરો",
      invalidDate: "માન્ય તારીખ દાખલ કરો",
      positiveNumber: "શૂન્ય કરતાં વધુ હોવું જોઈએ",
      nonNegative: "નકારાત્મક ન હોઈ શકે"
    },
    toast: {
      success: "કાર્ય સફળતાપૂર્વક પૂર્ણ થયું",
      error: "ભૂલ આવી છે",
      saved: "ફેરફારો સચવાયા છે",
      deleted: "રેકોર્ડ કાઢી નાખવામાં આવ્યો છે",
      created: "રેકોર્ડ સફળતાપૂર્વક બનાવવામાં આવ્યો છે"
    }
  },
  contacts: {
    title: "સંપર્કો (Contacts)",
    subtitle: "ગ્રાહકો, વેપારીઓ અને ભાગીદારોનું સંચાલન",
    createContact: "નવો સંપર્ક",
    editContact: "સંપર્કમાં ફેરફાર કરો",
    types: {
      customer: "ગ્રાહક (Customer)",
      vendor: "વેપારી (Vendor)",
      both: "ગ્રાહક અને વેપારી બંને"
    },
    fields: {
      name: "સંપર્કનું નામ",
      type: "સંપર્ક પ્રકાર",
      email: "ઇમેઇલ સરનામું",
      mobile: "મોબાઇલ નંબર",
      address: "શેરી / સરનામું",
      city: "શહેર",
      state: "રાજ્ય",
      pincode: "પીન કોડ",
      taxId: "જીએસટીઆઇએન / કર નંબર",
      portalAccess: "પોર્ટલ ઍક્સેસ આપો",
      status: "સ્થિતિ"
    },
    tabs: {
      details: "વિગતો",
      invoices: "ગ્રાહક ઇનવોઇસ (Invoices)",
      bills: "વેપારી બિલ (Bills)",
      payments: "ચુકવણીઓ અને ખાતાવહી"
    }
  },
  products: {
    title: "ઉત્પાદનો (Products)",
    subtitle: "વેચાણ અને ખરીદી માટેની વસ્તુઓ અને સેવાઓ",
    createProduct: "નવું ઉત્પાદન",
    editProduct: "ઉત્પાદનમાં ફેરફાર કરો",
    types: {
      goods: "ભૌતિક માલસામાન (Goods)",
      service: "સેવા (Service)"
    },
    fields: {
      name: "ઉત્પાદનનું નામ",
      sku: "એસકેયુ / કોડ",
      type: "ઉત્પાદન પ્રકાર",
      category: "વર્ગીકરણ (Category)",
      salesPrice: "વેચાણ કિંમત",
      costPrice: "મૂળ કિંમત / પડતર",
      salesTax: "વેચાણ કર",
      purchaseTax: "ખરીદ કર",
      incomeAccount: "આવક ખાતું (Income Account)",
      expenseAccount: "ખર્ચ ખાતું (Expense Account)",
      description: "વર્ણન",
      status: "સ્થિતિ"
    },
    categories: {
      title: "ઉત્પાદન વર્ગો",
      createCategory: "નવો વર્ગ",
      name: "વર્ગનું નામ",
      parent: "મુખ્ય વર્ગ"
    }
  },
  accounts: {
    title: "ખાતાઓનું ચાર્ટ (Chart of Accounts)",
    subtitle: "નામા પદ્ધતિ માટે ખાતાવહીના મુખ્ય ખાતાઓ",
    createAccount: "નવું ખાતું",
    editAccount: "ખાતામાં ફેરફાર કરો",
    types: {
      asset: "મિલકત / સંપત્તિ (Asset)",
      liability: "જવાબદારી / દેવું (Liability)",
      equity: "મૂડી (Equity)",
      income: "આવક (Income)",
      expense: "ખર્ચ (Expense)"
    },
    fields: {
      code: "ખાતા કોડ",
      name: "ખાતાનું નામ",
      type: "ખાતાનો પ્રકાર",
      parent: "મુખ્ય ખાતું",
      openingBalance: "શરૂઆતની સિલક (Opening Balance)",
      currentBalance: "હાલની સિલક",
      isSystem: "સિસ્ટમ ખાતું",
      status: "સ્થિતિ"
    }
  },
  journals: {
    title: "રોજમેળ / જર્નલ (Journals)",
    subtitle: "વ્યવહારોની નોંધ અલગ પાડવા માટેના રોજમેળ",
    createJournal: "નવો રોજમેળ",
    editJournal: "રોજમેળમાં ફેરફાર કરો",
    types: {
      sales: "વેચાણ રોજમેળ (Sales Journal)",
      purchase: "ખરીદ રોજમેળ (Purchase Journal)",
      bank: "બેંક રોજમેળ (Bank Journal)",
      cash: "રોકડ મેળ (Cash Journal)",
      general: "સામાન્ય રોજમેળ (General Journal)"
    },
    fields: {
      code: "રોજમેળ કોડ",
      name: "રોજમેળનું નામ",
      type: "પ્રકાર",
      defaultDebitAccount: "ડિફૉલ્ટ ઉધાર ખાતું (Debit Account)",
      defaultCreditAccount: "ડિફૉલ્ટ જમા ખાતું (Credit Account)",
      sequencePrefix: "ક્રમ પૂર્વગ (Prefix)"
    }
  },
  journalEntries: {
    title: "જર્નલ એન્ટ્રીઓ (Journal Entries)",
    subtitle: "બેવડી નામા પદ્ધતિ મુજબ સામાન્ય ખાતાવહી વ્યવહારો",
    createEntry: "નવી જર્નલ એન્ટ્રી",
    editEntry: "એન્ટ્રીમાં ફેરફાર કરો",
    fields: {
      entryNumber: "એન્ટ્રી નંબર #",
      date: "તારીખ",
      journal: "રોજમેળ",
      reference: "સંદર્ભ",
      narration: "વિગત / નોંધ",
      status: "સ્થિતિ",
      account: "ખાતું",
      partner: "ભાગીદાર / સંપર્ક",
      debit: "ઉધાર (₹)",
      credit: "જમા (₹)",
      totalDebit: "કુલ ઉધાર",
      totalCredit: "કુલ જમા",
      unbalanced: "અસંતુલિત એન્ટ્રી (તફાવત: {diff})",
      balanced: "સંતુલિત એન્ટ્રી"
    },
    actions: {
      postToLedger: "ખાતાવહીમાં નોંધો (Post)",
      reverse: "એન્ટ્રી ઉલટાવો (Reverse)"
    }
  },
  analyticAccounts: {
    title: "વિશ્લેષણાત્મક ખાતાઓ (Analytic Accounts)",
    subtitle: "સંચાલકીય હિસાબ માટે ખર્ચ કેન્દ્રો અને પ્રોજેક્ટ્સ",
    createAccount: "નવું વિશ્લેષણાત્મક ખાતું",
    editAccount: "વિશ્લેષણાત્મક ખાતામાં ફેરફાર કરો",
    fields: {
      name: "વિશ્લેષણાત્મક ખાતાનું નામ",
      code: "કોડ",
      department: "વિભાગ / પ્રોજેક્ટ",
      budget: "ફાળવેલ બજેટ",
      status: "સ્થિતિ"
    }
  },
  budgets: {
    title: "બજેટ (Budgets)",
    subtitle: "વિશ્લેષણાત્મક ખાતા દ્વારા આયોજન અને તફાવત ટ્રેકિંગ",
    createBudget: "નવું બજેટ",
    editBudget: "બજેટમાં ફેરફાર કરો",
    fields: {
      name: "બજેટનું નામ",
      periodStart: "શરૂઆતની તારીખ",
      periodEnd: "અંતિમ તારીખ",
      analyticAccount: "વિશ્લેષણાત્મક ખાતું",
      responsible: "જવાબદાર મેનેજર",
      plannedAmount: "આયોજિત રકમ (Planned)",
      actualAmount: "વાસ્તવિક રકમ (Actual)",
      variance: "તફાવત (Variance)",
      consumption: "વપરાશ (%)"
    }
  },
  taxes: {
    title: "કર દરો (Tax Rates)",
    subtitle: "વેચાણ અને ખરીદી માટેના કર નિયમો",
    createTax: "નવો કર",
    editTax: "કરમાં ફેરફાર કરો",
    scopes: {
      sales: "માત્ર વેચાણ",
      purchase: "માત્ર ખરીદી",
      both: "વેચાણ અને ખરીદી બંને"
    },
    types: {
      percentage: "ટકાવારી (%)",
      fixed: "નિશ્ચિત રકમ"
    },
    fields: {
      name: "કરનું નામ",
      rate: "દર (%)",
      scope: "ક્ષેત્ર (Scope)",
      computation: "ગણતરી પ્રકાર",
      collectedAccount: "ઉઘરાવેલ કર ખાતું (દેવું)",
      paidAccount: "ચૂકવેલ કર ખાતું (જમા)",
      status: "સ્થિતિ"
    }
  },
  purchases: {
    title: "ખરીદ ઓર્ડર (Purchase Orders)",
    subtitle: "ખરીદી ઓર્ડર અને વેપારી પુષ્ટિ",
    createOrder: "નવો ખરીદ ઓર્ડર",
    vendorBillsTitle: "વેપારી બિલ (Vendor Bills)",
    createBill: "નવું વેપારી બિલ",
    fields: {
      orderNumber: "પીઓ નંબર #",
      billNumber: "બિલ નંબર #",
      vendor: "વેપારી (Vendor)",
      orderDate: "ઓર્ડર તારીખ",
      billDate: "બિલ તારીખ",
      dueDate: "ચુકવણી તારીખ",
      reference: "વેપારી સંદર્ભ",
      untaxedTotal: "કર વિનાની કુલ રકમ",
      taxTotal: "કુલ કર",
      totalAmount: "કુલ રકમ",
      paidAmount: "ચૂકવેલ રકમ",
      amountDue: "બાકી રકમ",
      notes: "નિયમો અને શરતો"
    },
    lines: {
      product: "ઉત્પાદન / માલસામાન",
      description: "વર્ણન",
      account: "ખર્ચ ખાતું (Expense Account)",
      quantity: "જથ્થો",
      unitPrice: "એકમ કિંમત",
      tax: "કર",
      amount: "કુલ રકમ",
      addLine: "વસ્તુ ઉમેરો",
      removeLine: "દૂર કરો"
    }
  },
  sales: {
    title: "વેચાણ ઓર્ડર (Sales Orders)",
    subtitle: "ગ્રાહક ઓર્ડર અને વેચાણ દરખાસ્તો",
    createOrder: "નવો વેચાણ ઓર્ડર",
    invoicesTitle: "ગ્રાહક ઇનવોઇસ (Customer Invoices)",
    createInvoice: "નવું ગ્રાહક ઇનવોઇસ",
    fields: {
      orderNumber: "એસઓ નંબર #",
      invoiceNumber: "ઇનવોઇસ નંબર #",
      customer: "ગ્રાહક (Customer)",
      orderDate: "ઓર્ડર તારીખ",
      invoiceDate: "ઇનવોઇસ તારીખ",
      dueDate: "ચુકવણી તારીખ",
      reference: "ચુકવણી સંદર્ભ",
      untaxedTotal: "કર વિનાની કુલ રકમ",
      taxTotal: "કુલ કર",
      totalAmount: "કુલ રકમ",
      paidAmount: "મળેલ રકમ",
      amountDue: "બાકી રકમ",
      notes: "ચુકવણી શરતો"
    },
    lines: {
      product: "ઉત્પાદન / માલસામાન",
      description: "વર્ણન",
      account: "આવક ખાતું (Income Account)",
      quantity: "જથ્થો",
      unitPrice: "એકમ કિંમત",
      tax: "કર",
      amount: "કુલ રકમ",
      addLine: "વસ્તુ ઉમેરો",
      removeLine: "દૂર કરો"
    }
  },
  payments: {
    title: "ચુકવણીઓ (Payments)",
    subtitle: "ગ્રાહકો પાસેથી આવક અને વેપારીઓને ચુકવણી",
    createPayment: "ચુકવણી નોંધો",
    directions: {
      inbound: "ગ્રાહક આવક (Inbound)",
      outbound: "વેપારી ચુકવણી (Outbound)"
    },
    methods: {
      cash: "રોકડ (Cash)",
      bank: "બેંક ટ્રાન્સફર (NEFT/RTGS)",
      card: "કાર્ડ ચુકવણી",
      cheque: "ચેક"
    },
    fields: {
      paymentNumber: "ચુકવણી #",
      contact: "ભાગીદાર / સંપર્ક",
      date: "ચુકવણી તારીખ",
      amount: "મળેલ / ચૂકવેલ રકમ",
      direction: "ચુકવણી પ્રકાર",
      method: "ચુકવણી પદ્ધતિ",
      journal: "ચુકવણી રોજમેળ",
      reference: "વ્યવહાર / ચેક નંબર",
      allocated: "ફાળવેલ રકમ",
      unallocated: "બાકી રકમ",
      status: "સ્થિતિ"
    },
    allocation: {
      title: "ઇનવોઇસ / બિલ ફાળવણી",
      document: "દસ્તાવેજ નંબર #",
      originalAmount: "કુલ રકમ",
      openBalance: "બાકી રકમ",
      allocatedNow: "આ ચુકવણી ફાળવો"
    }
  },
  reports: {
    title: "નાણાકીય અહેવાલો (Reports)",
    subtitle: "સરવૈયું, નફા-નુકસાન અને સંચાલકીય અહેવાલો",
    balanceSheet: {
      title: "સરવૈયું (Balance Sheet)",
      subtitle: "ચોક્કસ તારીખની નાણાકીય સ્થિતિનું પત્રક",
      assets: "મિલકતો (Assets)",
      liabilities: "દેવાં / જવાબદારીઓ (Liabilities)",
      equity: "મૂડી અને સંચિત નફો (Equity)",
      totalAssets: "કુલ મિલકતો",
      totalLiabilitiesEquity: "કુલ દેવાં અને મૂડી",
      currentYearEarnings: "ચાલુ વર્ષનો વહેંચાયા વિનાનો નફો"
    },
    profitLoss: {
      title: "નફા-નુકસાન પત્રક (Profit & Loss)",
      subtitle: "પસંદ કરેલ સમયગાળા માટે આવક-ખર્ચ પત્રક",
      operatingIncome: "કામગીરી આવક (Operating Revenue)",
      costOfSales: "વેચાયેલ માલની પડતર (COGS)",
      grossProfit: "કાચો નફો (Gross Profit)",
      operatingExpenses: "કામગીરી ખર્ચ (Operating Expenses)",
      netProfit: "ચોખ્ખો નફો / (નુકસાન)"
    },
    budgetReport: {
      title: "બજેટ વિરુદ્ધ વાસ્તવિક (Budget vs Actuals)",
      subtitle: "ખર્ચ કેન્દ્રોમાં આયોજન વિરુદ્ધ વાસ્તવિક ખર્ચનું વિશ્લેષણ",
      account: "ખર્ચ કેન્દ્ર (Cost Center)",
      planned: "આયોજિત ખર્ચ",
      actual: "વાસ્તવિક ખર્ચ",
      variance: "તફાવત (બચત / વધારાનો ખર્ચ)"
    },
    toolbar: {
      asOfDate: "આ તારીખ સુધીનું (As of Date)",
      dateRange: "સમયગાળો",
      thisMonth: "આ મહિનો",
      thisQuarter: "આ ત્રિમાસિક",
      thisFY: "આ નાણાકીય વર્ષ",
      custom: "કસ્ટમ સમયગાળો"
    }
  },
  portal: {
    title: "પાર્ટનર પોર્ટલ (Partner Portal)",
    welcome: "આપનું સ્વાગત છે, {name}",
    subtitle: "ઇનવોઇસ જુઓ અને ચૂકવો, ખાતા વિગતોની સમીક્ષા કરો",
    kpis: {
      outstanding: "કુલ બાકી રકમ",
      overdue: "મુદત વીતી ગયેલ રકમ",
      paidThisYear: "આ નાણાકીય વર્ષમાં ચૂકવેલ"
    },
    invoices: {
      title: "તમારા ઇનવોઇસ",
      empty: "કોઈ ઇનવોઇસ મળ્યા નથી."
    },
    bills: {
      title: "તમારા બિલ",
      empty: "કોઈ વેપારી બિલ ઉપલબ્ધ નથી."
    },
    pay: {
      payInvoice: "ઇનવોઇસ નંબર {number} ચૂકવો",
      amountPrompt: "ચૂકવવાની રકમ",
      cardPlaceholder: "ડેબિટ / ક્રેડિટ કાર્ડ",
      proceed: "ચુકવણી માટે આગળ વધો"
    }
  },
  users: {
    title: "ટીમ સભ્યો (Team Members)",
    subtitle: "વપરાશકર્તા ઍક્સેસ, આમંત્રણ અને ભૂમિકાઓનું સંચાલન",
    inviteUser: "ટીમ સભ્યને આમંત્રિત કરો",
    fields: {
      name: "પૂરું નામ",
      email: "ઇમેઇલ સરનામું",
      role: "સોંપેલ ભૂમિકા",
      status: "ખાતાની સ્થિતિ",
      invitedAt: "આમંત્રણ તારીખ"
    },
    roles: {
      admin: "બિઝનેસ ઓનર (Admin)",
      manager: "એકાઉન્ટન્ટ (Manager)",
      user: "સંપર્ક / ગ્રાહક (User)"
    },
    dialog: {
      inviteTitle: "નવા ટીમ સભ્યને આમંત્રિત કરો",
      inviteDesc: "પાસવર્ડ સેટ કરવા માટે સુરક્ષિત લિંક સાથેનું ઇમેઇલ આમંત્રણ મોકલવામાં આવશે.",
      sendInvite: "આમંત્રણ મોકલો",
      sending: "મોકલી રહ્યું છે…"
    },
    status: {
      active: "સક્રિય",
      invited: "આમંત્રિત (પાસવર્ડ બાકી)",
      deactivated: "નિષ્ક્રિય કરેલ"
    }
  }
};

function updateJsonFile(filePath, namespaces) {
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const updated = { ...existing, ...namespaces };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log(`Updated ${path.basename(filePath)} successfully.`);
}

updateJsonFile(path.join(MESSAGES_DIR, 'en.json'), enNamespaces);
updateJsonFile(path.join(MESSAGES_DIR, 'hi.json'), hiNamespaces);
updateJsonFile(path.join(MESSAGES_DIR, 'gu.json'), guNamespaces);

console.log('Phase 4 i18n update complete.');
