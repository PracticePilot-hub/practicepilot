import { NextResponse } from "next/server";
import { base } from "../../lib/airtable";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      clientName,
      clientType,
      internalCode,
      status,
      yearEnd,
      tradingName,
      registrationNumber,
      registrationDate,

      primaryContact,
      email,
      telephone,
      cellphone,

      vatNumber,
      payeNumber,
      incomeTaxNumber,
      uifNumber,
      customsNumber,
      sdlRegistered,
      wccRefNr,
      financials, 

      physicalAddressLine1,
      physicalAddressLine2,
      physicalSuburb,
      physicalCity,
      physicalProvince,
      physicalPostalCode,

      postalAddressLine1,
      postalAddressLine2,
      postalSuburb,
      postalCity,
      postalProvince,
      postalPostalCode,

      clientLead,
      manager,
      partner,

      // SERVICES (IMPORTANT – NOT CLIENT IMPORT)
      accounting,
      vat,
      payroll,
      provisionalTax,
      incomeTax,
    } = body;

    // =========================
    // 1. CREATE CLIENT IMPORT
    // =========================

    const clientRecord = await base("CLIENT IMPORT").create([
      {
        fields: {
          "Client Name": clientName || "",
          "Entity Type": clientType || undefined,
          "Status": status || undefined,  
          "Year End": yearEnd || undefined,
          "Trading Name": tradingName || "",
          "Registration Number": registrationNumber || "",
          "Registration Date": registrationDate || "",
          "Client Code": internalCode || "",


          "PAYE Nr": payeNumber || "",
          "Tax Nr": incomeTaxNumber || "",
          "VAT Nr": vatNumber || "",
          "UIF Reg": uifNumber || "",
          "Customs Nr": customsNumber ? String(customsNumber) : "", 
          "WCC Ref Nr": wccRefNr ? String(wccRefNr) : "",
          "SDL Registered": !!sdlRegistered,
          

          "Primary Contact Name": primaryContact || "",
          "Primary Contact Email": email || "",
          "Primary Contact Telephone": telephone || "",
          "Primary Contact Cellphone": cellphone || "", 

          "Physical Address": physicalAddressLine1 || "",
          "Physical Address Line 2": physicalAddressLine2 || "",
          "Physical Address Line 3": physicalSuburb || "",
          "Physical Address City": physicalCity || "",
          "Physical Address Province": physicalProvince || "",
          

         "Postal Address": postalAddressLine1 || "",  
          "Postal Address Line 2": postalAddressLine2 || "",
          "Postal Address Line 3": postalSuburb || "",
          "Postal Address City": postalCity || "",
          "Postal Address Province": postalProvince || "",
          

          "Client Lead": clientLead || "",
          "Client Manager": manager || "",
          "Client Partner": partner || "",
        },
      },
    ]);

    const clientsTable = base("Clients");

const newClient = await clientsTable.create([
  {
    fields: {
      "Client Name": clientName || "",
      "Entity Type": clientType || "",
      "Status": status || "",
      "Year End": yearEnd || "",
    },
  },
]);

const clientId = newClient[0].id;

    const servicesTable = base("Services");
const clientServicesTable = base("Client Services");

// VAT
if (vat && vat !== "None") {
  const vatService = await servicesTable
    .select({
      filterByFormula: `{Service Name} = 'VAT201'`,
      maxRecords: 1,
    })
    .firstPage();

  if (vatService.length > 0) {
    await clientServicesTable.create([
      {
        fields: {
          Clients: [clientId],
          Service: [vatService[0].id],
          "VAT Category": vat,
          "Service Cycle": "Bi-Monthly",
        },
      },
    ]);
  }
}

// Payroll
if (payroll && payroll !== "None") {
  const payrollService = await servicesTable
    .select({
      filterByFormula: `{Service Name} = 'Payroll'`,
      maxRecords: 1,
    })
    .firstPage();

  if (payrollService.length > 0) {
    await clientServicesTable.create([
      {
        fields: {
          Clients: [clientId],
          Service: [payrollService[0].id],
          "Service Cycle": payroll,
        },
      },
    ]);
  }
}

// Financial Statements
if (financials) {
  const afsService = await servicesTable
    .select({
      filterByFormula: `{Service Name} = 'Financial Statements'`,
      maxRecords: 1,
    })
    .firstPage();

  if (afsService.length > 0) {
    await clientServicesTable.create([
      {
        fields: {
          Clients: [clientId],
          Service: [afsService[0].id],
          "Service Cycle": "Annually",
        },
      },
    ]);
  }
}

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("SAVE ERROR:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
}   