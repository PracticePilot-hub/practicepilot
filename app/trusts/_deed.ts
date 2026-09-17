import type { TrustParty, TrustRecord } from "./_lib";

function e(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayPartyName(party: TrustParty) {
  if (party.party_kind === "entity" && party.representative_name) {
    return `${party.full_name} represented by ${party.representative_name}`;
  }
  return party.full_name;
}

function identityLine(party: TrustParty) {
  return party.party_kind === "entity"
    ? `Registration number ${e(party.registration_number || "________________")}`
    : `Identity number ${e(party.id_number || "________________")}`;
}

function addressLine(party: TrustParty) {
  return [
    party.address_line1,
    party.address_line2,
    party.city,
    party.province,
    party.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function capitalBeneficiaryLabel(party: TrustParty) {
  const id = party.id_number ? `, identity number ${e(party.id_number)}` : "";
  const descendants = party.include_descendants ? ", and their Descendants" : "";
  return `${e(party.full_name.toUpperCase())}${id}${descendants};`;
}

function incomeBeneficiaryLabel(party: TrustParty, previous: TrustParty[]) {
  const alreadyNamed = previous.some((item) => item.id === party.id);
  if (alreadyNamed) {
    return `${e(party.full_name.toUpperCase())}, aforementioned${
      party.include_descendants ? ", and their Descendants" : ""
    };`;
  }
  return capitalBeneficiaryLabel(party);
}

function fallbackNames(parties: TrustParty[]) {
  const names = parties.map((party) => party.full_name.toUpperCase()).filter(Boolean);
  if (!names.length) return "THE NAMED BENEFICIARIES";
  if (names.length === 1) return e(names[0]);
  if (names.length === 2) return `${e(names[0])} AND ${e(names[1])}`;
  return `${names.slice(0, -1).map(e).join(", ")} AND ${e(names[names.length - 1])}`;
}

function partyBlock(founder: TrustParty | undefined, firstTrustees: TrustParty[]) {
  const founderHtml = founder
    ? `<div class="party"><strong>${e(founder.full_name.toUpperCase())}</strong><br/>${identityLine(founder)}<br/><span class="party-capacity">(“the Founder”)</span></div>`
    : `<div class="party missing"><strong>FOUNDER TO BE CAPTURED</strong></div>`;

  const trusteesHtml = firstTrustees.length
    ? firstTrustees
        .map(
          (party, index) =>
            `${index ? '<div class="and">AND</div>' : ""}<div class="party"><strong>${e(
              displayPartyName(party)
            )}</strong><br/>${identityLine(party)}</div>`
        )
        .join("")
    : `<div class="party missing"><strong>TRUSTEES TO BE CAPTURED</strong></div>`;

  return `${founderHtml}<div class="and">AND</div>${trusteesHtml}<div class="party-capacity first-trustees">(“the First Trustees”)</div>`;
}

function beneficiaryBlock(parties: TrustParty[], prior: TrustParty[] = []) {
  if (!parties.length) {
    return `<div class="clause l2 missing">No beneficiaries captured.</div>`;
  }
  return parties
    .map(
      (party) =>
        `<div class="clause l2">${
          prior.length ? incomeBeneficiaryLabel(party, prior) : capitalBeneficiaryLabel(party)
        }</div>`
    )
    .join("");
}

function fallbackClause(parties: TrustParty[]) {
  return `<div class="clause l2">failing the existence of any members of the classes set out in the sub-clauses supra, only in that event, the heir or heirs (testate and/or intestate as determined by the Trustees, having regard to the respective financial circumstances of such heirs in such proportions as the Trustees in their sole, absolute and unfettered discretion determine) of ${fallbackNames(
    parties
  )}, aforementioned;</div>`;
}

function independentDefinition(independent: TrustParty | undefined) {
  const name = independent
    ? e(displayPartyName(independent))
    : "INDEPENDENT TRUSTEE TO BE CAPTURED";
  return `<div class="clause l1">“<strong>Independent Trustee</strong>” means <strong>${name}</strong>, aforementioned, or any successor in title, appointed in terms of the provisions of this Trust Deed, and in particular clause 7 below, who should on appointment and thereafter, as long as they serve as independent trustee, meet the requirements of an independent trustee as required by the Master of the High Court from time to time, or any other relevant legislation;</div>`;
}

function numberWords(value: number) {
  const map: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
  return map[value] || String(value);
}

function selectedMandatorySignatory(
  parties: TrustParty[],
  partyId: string | null | undefined
) {
  if (!partyId) return undefined;
  return parties.find((party) => party.id === partyId);
}

function signingClause(trust: TrustRecord, trustees: TrustParty[]) {
  const required = Math.max(1, Math.min(5, Number(trust.document_signatory_count || 1)));
  const words = `${required} (${numberWords(required)}) Trustee${required === 1 ? "" : "s"}`;
  const mandatory = selectedMandatorySignatory(trustees, trust.mandatory_signatory_party_id);
  const namedRequirement = mandatory
    ? ` This clause is subject to the requirement that, during their lifetime or existence, and as far as they are capable of doing so, <strong>${e(displayPartyName(mandatory).toUpperCase())}</strong>, aforementioned, must always be a signatory, unless otherwise approved by unanimous resolution by all Trustees.`
    : "";
  return `<div class="clause l1">The Trustees shall agree on the signing powers, by unanimous agreement in terms of the provisions of clause 13.9.9 above, subject to the requirement that all contracts, deeds, and other documents relating to this Trust have to be signed by at least ${words}, unless otherwise approved by unanimous resolution by all Trustees.${namedRequirement}</div>`;
}

function bankApprovalClause(trust: TrustRecord, trustees: TrustParty[]) {
  const required = Math.max(1, Math.min(5, Number(trust.bank_signatory_count || 1)));
  const words = `${required} (${numberWords(required)}) Trustee${required === 1 ? "" : "s"}`;
  const mandatory = selectedMandatorySignatory(trustees, trust.mandatory_signatory_party_id);
  const namedRequirement = mandatory
    ? ` This clause is subject to the requirement that, during their lifetime or existence, and as far as they are capable of doing so, <strong>${e(displayPartyName(mandatory).toUpperCase())}</strong>, aforementioned, must always be a signatory, unless otherwise approved by unanimous resolution by all Trustees.`
    : "";
  return `<div class="clause l1">Powers of approval on any bank account for this Trust will be unanimously decided by the Trustees in terms of the provisions of clause 13.9.10 above, subject to the requirement that at least ${words} have to approve any bank transactions, unless otherwise approved by unanimous resolution by all Trustees.${namedRequirement}</div>`;
}

function domiciliaBlock(founder: TrustParty | undefined, trustees: TrustParty[]) {
  const rows: string[] = [];
  if (founder) {
    rows.push(`<tr><td>Founder${founder.role_trustee ? " and Trustee" : ""}</td><td><strong>${e(
      displayPartyName(founder)
    )}</strong></td></tr><tr><td>Notice address:</td><td>${e(addressLine(founder) || "________________")}</td></tr><tr><td>Email address:</td><td>${e(founder.email || "________________")}</td></tr>`);
  }
  trustees
    .filter((party) => party.id !== founder?.id)
    .forEach((party) => {
      rows.push(`<tr><td>${party.role_independent_trustee ? "Independent Trustee" : "Trustee"}</td><td><strong>${e(
        displayPartyName(party)
      )}</strong></td></tr><tr><td>Notice address:</td><td>${e(addressLine(party) || "________________")}</td></tr><tr><td>Email address:</td><td>${e(party.email || "________________")}</td></tr>`);
    });
  return `<table class="domicilia"><tbody>${rows.join("")}</tbody></table>`;
}

function signatureBlock(founder: TrustParty | undefined, trustees: TrustParty[]) {
  const rows: string[] = [];
  if (founder) {
    rows.push(`<div class="signature"><div class="signature-line"></div><strong>${e(
      displayPartyName(founder).toUpperCase()
    )}</strong><span>(Founder)</span></div>`);
  }
  trustees.forEach((party) => {
    rows.push(`<div class="signature"><div class="signature-line"></div><strong>${e(
      displayPartyName(party).toUpperCase()
    )}</strong><span>(${party.role_independent_trustee ? "Independent Trustee" : "Trustee"})</span></div>`);
  });
  return rows.join("");
}

const MASTER_DEED_BODY = String.raw`<div class="deed-title">DEED OF TRUST</div>
<p class="entered-between">entered into between</p>
{{PARTY_BLOCK}}
<div class="clause l0">PREAMBLE</div>
<div class="clause l1">It is the intention and desire of the Founder to create this Trust for the benefit and Welfare of one or more of the Beneficiaries referred to in this Trust Deed, on the terms and conditions as more fully set out hereunder.</div>
<div class="clause l1">The First Trustees have been nominated and have accepted their appointment, and to act as such, on the terms and conditions hereinafter set out, in the interests of the nominated Beneficiaries in this Trust Deed.  </div>
<div class="clause l0">INTERPRETATION</div>
<p class="normal">In this Trust Deed, unless it appears otherwise from the context -</p>
<div class="clause l1">“Accountable Institution” bears the meaning ascribed to it in Section 1(1) of and Schedule 1 to the Financial Intelligence Centre Act 38 of 2001;</div>
<div class="clause l1">“allocate”, “distribute”, “vest” and/or “pay” and their derivatives mean and include the words award, deliver, use, utilise, benefit, hand over, make over, give, possess, cede, transfer, assign, and their respective derivatives;</div>
<div class="clause l1">“Beneficial Owner/s” bears the meaning ascribed to it in Section 1 of the Trust Property Control Act 57 of 1988, as amended;</div>
<div class="clause l1">“Beneficiaries” means that Person, those Persons or classes of Persons (excluding unborn children, who shall not be recognised as having any rights under this Trust Deed) included in Income Beneficiaries and/or Capital Beneficiaries;</div>
<div class="clause l1">“Capital Beneficiaries” means those Beneficiaries who may benefit from the allocation, distribution, vesting, or payment (including distributions in specie) of capital gains, or Trust Property, or any portion thereof, or its application for those Beneficiaries’ benefit, under this Trust, in terms of the discretionary powers conferred upon the Trustees, and which Beneficiaries shall be selected by the Trustees, in their sole, absolute and unfettered discretion, from amongst the following named Beneficiaries and classes of Beneficiaries:</div>
{{CAPITAL_BENEFICIARIES}}
<div class="clause l2">any further trust established for the benefit of any of the aforementioned; and</div>
{{CAPITAL_FALLBACK}}
<div class="clause l1">“Costs” means all lawful, reasonable, and necessary costs, charges, expenses, and tax (if any) incurred by the Trustees on behalf of this Trust in connection with the management and administration of this Trust in terms of this Trust Deed, including any amount in respect of which a Trustee has been lawfully indemnified in terms of the provisions of clause 14 below and any indemnity provided to Trustees otherwise, and any money required to comply with the obligations of the Trustees under this Trust Deed, litigation costs against this Trust, or the Trustees, and if, for any reason, the Trustees are at any time required to furnish security, the costs from time to time of furnishing such security, and Trustee remuneration; </div>
<div class="clause l1">“Descendants” shall be given its widest meaning and shall include born descendants and adopted children, the intent and purpose being that for all purposes under this Trust Deed, an adopted child shall be deemed to be the lawful issue of the Person or Persons who adopted them;</div>
<div class="clause l1">“Financial Year” of this Trust shall commence on 1 March and end on the last day of February each year (or as at such other date as the Trustees shall from time to time determine, per the directives of the Commissioner of the South African Revenue Service, in terms of the provisions of the Income Tax Act 58 of 1962, as amended); </div>
<div class="clause l1">“guardian” includes “administrator”, “curator” and any other person appointed to manage the affairs of another;</div>
<div class="clause l1">“Income” means the earnings gained from the provision of services or goods, or the use of Trust Property;</div>
<div class="clause l1">“Income Beneficiaries” means those Beneficiaries who may benefit from the allocation, distribution, vesting, or payment of Income, net Income, profits, or any portion thereof, or its application for those Beneficiaries’ benefit, under this Trust, and who may, subject to the approval of the Trustees in their sole, absolute and unfettered discretion be entitled to use or have the use of Trust Property in a manner allowed in this Trust Deed, in terms of the discretionary powers conferred upon the Trustees, and which Beneficiaries shall be selected by the Trustees, in their sole, absolute and unfettered discretion, from amongst the following named Beneficiaries and classes of Beneficiaries:</div>
{{INCOME_BENEFICIARIES}}
<div class="clause l2">any further trust established for the benefit of any of the aforementioned; and</div>
{{INCOME_FALLBACK}}
{{INDEPENDENT_TRUSTEE_DEFINITION}}
<div class="clause l1">“Major” means a Person over the age of 18 (eighteen) years as defined in the Children’s Act 38 of 2005, as amended;</div>
<div class="clause l1">“Master of the High Court” means the Master, Deputy Master, or Assistant Master of the High Court as defined in the Trust Property Control Act 57 of 1988, as amended, having jurisdiction over this Trust, by virtue of where this Trust Deed is lodged and registered, or where the majority of the Trust Property is situated, save that the jurisdiction may change as specified in the Trust Property Control Act 57 of 1988, as amended;</div>
<div class="clause l1">“Minor” means a Person under the age of 18 (eighteen) years as defined in the Children’s Act 38 of 2005, as amended;</div>
<div class="clause l1">“Person” shall include any individual or any body of persons, corporate or unincorporated;</div>
<div class="clause l1">“Spouse” means any natural Person, who, relative to a Person mentioned in this Trust Deed:</div>
<div class="clause l2">is in a marriage, partnership, or union of a permanent nature with such Person, which marriage, partnership, or union of a permanent nature is in terms of the provisions of any statute recognised as such;</div>
<div class="clause l2">is in a marriage, partnership, or union of a permanent nature with such Person, which marriage, partnership, or union of a permanent nature is recognised in terms of any religious tenet; or</div>
<div class="clause l2">is in a marriage, partnership, or union of a permanent nature with such Person, which marriage, partnership, or union of a permanent nature is recognised by any customary or other body, not falling within the ambit of the provisions of clauses 2.18.1 and 2.18.2 above;</div>
<div class="clause l1">“the Trustees” means the First Trustees appointed in terms of this Trust Deed and those further Persons appointed as trustees under this Trust Deed, and who agree to act as such, and who are duly authorised by the Master of the High Court, in terms of the provisions of clause 7 below;</div>
<div class="clause l1">“this Trust” means this trust created in terms of the provisions of this Trust Deed, which is an irrevocable, protective discretionary trust; </div>
<div class="clause l1">“this Trust Deed” means this contract, which shall be construed to be the constitutive charter of this Trust, based on the terms and conditions as set out herein, read together with any future amendments, variations, or changes to this contract as permitted in terms of this contract, which the First Trustees hereby undertake to lodge with the Master of the High Court;</div>
<div class="clause l1">“Trust Capital” means the sum of all Trust Property minus the aggregate of:</div>
<div class="clause l2">the liabilities of this Trust; and</div>
<div class="clause l2">the sum of all provisions for depreciation, renewals, or diminution in value of Trust Property;</div>
<p class="normal">as determined by the Trustees in their sole, absolute, and unfettered discretion;</p>
<div class="clause l1">“Trust Property” means:</div>
<div class="clause l2">any assets in the form of money, property, shares, loans, rights, benefits, whether corporeal or incorporeal, and whether movable or immovable, which the Trustees, in their capacity as such, on behalf of this Trust, may acquire by donation (including the donation referred to in clause 4 below), distribution, vesting, inheritance, purchase, acquisition, investment, loan, transfer, exchange or otherwise; and</div>
<div class="clause l2">the increase or decrease in such assets;</div>
<div class="clause l1">“vest or vesting”, in relation or pertaining to any Beneficiary, means the allocation, distribution, or payment of any Income, net Income, profits, capital gains, or Trust Property, or any portion thereof, unconditionally, to such a Beneficiary, or the application thereof for their benefit or for the benefit of another Person (in terms of the provisions of clause 19.2.2.2 below), or the allowance of the use of Trust Property by any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) without any real right vesting in such Beneficiary or Person, or any form of ownership to pass to such Beneficiary or Person from such use, in the sole, absolute and unfettered discretion of the Trustees; </div>
<div class="clause l1">“Welfare”, besides the ordinary meaning of the word, also means the benefit, comfort, maintenance, education (including tertiary education), advancement in life, and pleasures of the Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) concerned, and shall include all those matters and purposes which the Trustees, in their sole, absolute and unfettered discretion, may consider to be in the interest, or for the advantage of, such Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), in terms of this Trust Deed;</div>
<div class="clause l1">subject to the provisions of the Income Tax Act 58 of 1962, as amended, the words “capital”, “capital gain”, “capital loss”, “loss”, “operating loss”, “assessed loss”, “net loss”, “profits”, and “income” shall be given their widest meaning;</div>
<div class="clause l1">the concept of “Company” will be limited to its strict technical meaning as contained in the Companies Act 71 of 2008, as amended, to clearly distinguish it from a Close Corporation and will in no way be interpreted to give a wide meaning of the word and concept of company;</div>
<div class="clause l1">any reference to “Close Corporation” means a Close Corporation as referred to in terms of the Close Corporations Act 69 of 1984, as amended;</div>
<div class="clause l1">words importing any one gender shall include the other genders and words importing the singular shall include the plural and vice versa;</div>
<div class="clause l1">where a Person is required to act in terms of this Trust Deed, it shall mean the Person as represented by any director of that Person, or the Person’s nominee appointed to act on its behalf, for the purpose of all actions and decisions required under this Trust Deed;</div>
<div class="clause l1">this Trust Deed should be read and interpreted as a whole and the respective clauses in this Trust Deed are not to be read in isolation of the other;</div>
<div class="clause l1">the headings are used for reference and convenience only and shall in no way be used to explain, amplify, modify, or aid in the interpretation of this Trust Deed;</div>
<div class="clause l1">where any term or provision is defined within the context of any particular clause in this Trust Deed, the term so defined, unless it is clear from the clause in question that the term so defined has limited application to the relevant clause, shall bear the meaning ascribed to it for all purposes in terms of this Trust Deed, notwithstanding that such term has been defined in that clause only;</div>
<div class="clause l1">wherever rights are conferred or assigned to a specific Person, it is done for the effective administration of this Trust, and should in no way be interpreted or construed as granting of control to such Person;</div>
<div class="clause l1">any reference to the “discretion”, “determination”, “decision”, “election”, “approval”, “stipulation” or “instruction” (or for the purposes hereof any other grammatical form of any of the aforementioned) of the Trustees shall mean the sole, absolute and unfettered discretion, determination, decision, election, approval, stipulation or instruction of the Trustees, and any exercise of such discretion or any decision, determination, election, approval, stipulation or instruction made by them pursuant to the provisions of this Trust Deed shall be unchallengeable by any Beneficiary or any other Person and shall be final and binding on them, unless expressly stated to the contrary in this Trust Deed;</div>
<div class="clause l1">where figures are referred to in numerals and words and there is a conflict between the two, the words shall prevail;</div>
<div class="clause l1">when any number of days are prescribed in this Trust Deed, same shall be reckoned exclusively of the first and inclusively of the last day, unless the last day falls on a Saturday, Sunday, or public holiday, in which case the last day shall be the next succeeding day which is not a Saturday, Sunday or public holiday, as prescribed in the Public Holidays Act 36 of 1994, as amended; and</div>
<div class="clause l1">should any question arise as to the interpretation of this Trust Deed, or any of its provisions, or as to the true construction thereof, or as to the administration of this Trust, or otherwise howsoever, the Trustees shall have the power to decide such question unanimously, in terms of the provisions of clause 13.9.1 below, either acting on their own judgment or upon the advice of counsel, and any such decision shall be final and binding on all parties.</div>
<div class="clause l0">NAME</div>
{{TRUST_NAME_CLAUSE}}
<div class="clause l1">The Trustees may, by unanimous resolution, change the name of this Trust in terms of the provisions of clause 13.9.2 below.</div>
<div class="clause l0">DONATION</div>
{{DONATION_CLAUSE}}
<div class="clause l1">Any Person shall be entitled to add to the Trust Property at any time by means of a further donation, bequest, loan, or otherwise in terms of this Trust Deed. Under these circumstances, the provisions of this Trust Deed shall be mutatis mutandis applicable to such additional Trust Property. No further trust deed shall be necessary to vest such additional Trust Property in the Trustees. It will be sufficient, by handing the additional Trust Property to the Trustees, to vest such Trust Property in the Trustees, subject to the provisions of this Trust Deed.</div>
<div class="clause l0">OBJECTIVES OF THIS TRUST</div>
<p class="normal">The principal objectives of this Trust are:</p>
<div class="clause l1">to preserve, maintain, and enhance the Trust Property;</div>
<div class="clause l1">at the sole, absolute, and unfettered discretion of the Trustees, to allocate, distribute, vest, and pay to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), and apply for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), any Income, net Income, profits, capital gains, and/or Trust Property, or any portion thereof; and</div>
<div class="clause l1">at the sole, absolute, and unfettered discretion of the Trustees, to authorise the use of any asset, movable or immovable, whether corporeal or incorporeal, comprising the Trust Property, subject to the provisions of this Trust Deed, for the benefit and Welfare of any Beneficiary or Person in terms of the provisions of clauses  12.4.35 and   19.2.2.2 below.</div>
<div class="clause l0">PRINCIPAL FUNCTIONS OF TRUSTEES</div>
<div class="clause l1">The Trustees hereby undertake to carry out the terms and conditions and stipulations contained in this Trust Deed.</div>
<div class="clause l1">Save for the fiduciary, administrative, and operational functions of the Trustees contained in this Trust Deed, the Trustees shall carry out and conduct the following principal operations and functions on behalf of this Trust, to facilitate and achieve the objectives of this Trust:</div>
<div class="clause l2">acquire all and any assets, including rights, movable or immovable, whether corporeal or incorporeal, for investment, holding, or any other purpose, as the Trustees in their sole, absolute, and unfettered discretion may determine;</div>
<div class="clause l2">invest and employ the Trust Property in the broadest sense in terms of this Trust Deed; and</div>
<div class="clause l2">ensure that the Trust Property is, as far as is practically possible, rendered productive, in terms of this Trust Deed.</div>
<div class="clause l0">APPOINTMENT, REMOVAL, AND REPLACEMENT OF TRUSTEES</div>
<div class="clause l1">The Trustees shall administer this Trust autonomously and the Trustees shall at all times function independently and impartially from the instructions and will of the Founder and Beneficiaries, subject to the provisions of this Trust Deed. To this end and to ensure that at all times this directive is upheld de facto and de jure, the Trustees shall undertake that the following provisions be met:</div>
<div class="clause l2">that at all times during the existence of this Trust, there shall be an Independent Trustee; and</div>
<div class="clause l2">if an Independent Trustee ceases to be a Trustee for any reason whatsoever, the Trustees shall appoint another Independent Trustee in terms of the provisions of clause 7.10 below. </div>
<div class="clause l1">There shall at all times be no less than 2 (two) and no more than 5 (five) Trustees in office for the purpose of the valid exercise of the powers and discharge of the duties of the Trustees in terms of this Trust Deed. No single Trustee shall directly or indirectly control the decision-making powers relating to this Trust.</div>
<div class="clause l1">If at any time there be fewer than 2 (two) Trustees in office, the remaining Trustee shall during such time act only to fill the vacancy in such office. During this time, the remaining Trustee shall specifically not be entitled to do any of the following:</div>
<div class="clause l2">appoint or remove any Trustees, other than provided for in this Trust Deed;</div>
<div class="clause l2">add or remove any Beneficiaries;</div>
<div class="clause l2">allocate, distribute, vest, or pay to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or apply for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), Income, net Income, profits, capital gains or Trust Property, or any portion thereof, or allow the use of Trust Property in terms of the provisions of clause 12.4.35 below;</div>
<div class="clause l2">acquire any assets for this Trust;</div>
<div class="clause l2">encumber any Trust Property;</div>
<div class="clause l2">sell or alienate any portion of the Trust Property;</div>
<div class="clause l2">amend this Trust Deed as per clause 24 below; and/or</div>
<div class="clause l2">deregister this Trust as per clause 25 below.</div>
<div class="clause l1">In order to qualify to be and act as a Trustee of this Trust, such Person shall:</div>
<div class="clause l2">qualify to act as a Trustee in terms of the provisions of this Trust Deed, the Trust Property Control Act 57 of 1988, as amended, and any other relevant legislation;</div>
<div class="clause l2">have the legal capacity to act as such;</div>
<div class="clause l2">be duly appointed in terms of this Trust Deed;</div>
<div class="clause l2">duly accept the appointment as set out in this Trust Deed; and</div>
<div class="clause l2">subject to the provisions of clause 7.13 below, be duly authorised by the Master of the High Court in terms of the Trust Property Control Act 57 of 1988, as amended. </div>
<div class="clause l1">The following Persons shall be disqualified from acting as Trustees:</div>
<div class="clause l2">a Person who is disqualified to act as a Trustee in terms of the provisions of Section 6(1) of the Trust Property Control Act 57 of 1988, as amended (but excludes the disqualification of a legal entity in terms of the provisions of Section 6(1A)(c)); and/or</div>
<div class="clause l2">the Spouse of the Founder, any Trustee or Beneficiary, unless they are hereby appointed as a Trustee, or unless such Spouse is also a Beneficiary (this clause is not capable of being amended or deleted).</div>
<div class="clause l1">A Trustee need not be a South African citizen, be resident or domiciled in South Africa, or be incorporated as a legal Person in South Africa.</div>
<div class="clause l1">Any Trustee for the time being of this Trust, being a corporation or legal persona, shall have the power to act by its proper officers and duly authorised representatives. If a representative of the corporation or legal persona ceases to act as a representative of that corporation or legal persona, such trustee corporation or legal persona must nominate a replacement representative and inform the Trustees and the Master of the High Court in writing thereof, as soon as this replacement takes place. Such replacement representative will only act as Trustee once they have been duly authorised by the Master of the High Court in terms of the Trust Property Control Act 57 of 1988, as amended.</div>
<div class="clause l1">Subject to the provisions of clause 7.13 below, on the written acceptance of their appointment as a Trustee, a Trustee shall be vested with all the powers and subject to all the duties of a Trustee, as if they had been one of the First Trustees of this Trust.</div>
<div class="clause l1">Subject to the provisions of clause 7.2 above, the Trustees shall at all times have the right to nominate and appoint such additional Trustee or Trustees as they may decide, provided that their decision to do so shall be unanimous, subject to the provisions of clause 13.9.3 below. If a decision cannot be reached between the parties, as envisaged in this clause, the matter shall be dealt with as envisaged in clause 14 below.</div>
<div class="clause l1">Subject to the provisions of  clause   7.13 below, a Trustee shall have the right to appoint a succeeding Trustee after their resignation or removal, or by way of their last will and testament upon their demise, provided such Trustee is also a Beneficiary in terms of this Trust Deed. If no such appointment is made, the replacement Trustee died, is deregistered before their appointment, or is disqualified to act as a Trustee in terms of the provisions of clause 7.6 above, the  Trustees, will upon unanimous decision appoint a replacement Trustee. In all other instances, the remaining Trustees, shall be empowered to appoint a replacement Trustee to take the place of a retired, deceased, or deregistered Trustee, by unanimous decision, subject to the provisions of clause 13.9.4 below. If a decision cannot be reached between the parties, as envisaged in this clause, the matter shall be dealt with as envisaged in clause 14 below.   </div>
<div class="clause l1">If any vacancy is incapable of being filled in terms of any of the provisions of this Trust Deed, the Master of the High Court, in terms of the provisions of Section 7 of the provisions of the Trust Property Control Act 57 of 1988, as amended, shall appoint and fill any such vacancy.</div>
<div class="clause l1">The office of any Trustee shall be vacated and the Trust Property shall cease to vest in such a Trustee, if such Trustee:</div>
<div class="clause l2">resigns (which they shall be entitled to do) after giving written notice thereof to the Master of the High Court, the Beneficiaries known to the resigning Trustee, and the remaining Trustee/s, subject to the provisions of clause 7.14 below;</div>
<div class="clause l2">dies or is deregistered (whichever is applicable);</div>
<div class="clause l2">becomes disqualified to be authorised as a Trustee in terms of the provisions of Section 6(1A) of the Trust Property Control Act 57 of 1988, as amended (but excludes the disqualification of a legal entity in terms of the provisions of Section 6(1A)(b));</div>
<div class="clause l2">fails to give security or additional security, as the case may be, to the satisfaction of the Master of the High Court within 2 (two) months after having been requested to do so by the Master, or within a further period that is allowed by the Master of the High Court;</div>
<div class="clause l2">who is a Company or Close Corporation, has commenced voluntary liquidation proceedings, or has been placed under business rescue, or has been placed under provisional or final liquidation, where applicable;</div>
<div class="clause l2">becomes of unsound mind or incapable of managing their affairs as defined in the Mental Health Care Act 17 of 2002, as amended, or for any other reason becomes incapable of acting as a Trustee, or unfit so to act, and certified as such by a neurologist or psychiatrist (as applicable);</div>
<div class="clause l2">is declared a prodigal or placed under curatorship by any competent court;</div>
<div class="clause l2">is removed from office by order of court or the Master of the High Court; or</div>
<div class="clause l2">who is not also a Beneficiary, is removed, as unanimously approved by the Trustees (only if they are 2 (two) or more in number). If a unanimous decision cannot be reached between the relevant parties, as envisaged in this clause, the matter shall be dealt with as envisaged in clause 14 below. A letter by the relevant parties, to inform such a Trustee of the decision to terminate their office as Trustee must be sent to such a Trustee, by registered mail, after the decision was taken. All the remaining Trustees and the known Beneficiaries shall also be informed in writing of the removal of such Trustee. The removal will only be registered with the Master of the High Court 14 (fourteen) days after this letter has been sent to the removed Trustee by registered mail. Proof of the registered mail sent to the removed Trustee has to be submitted to the Master of the High Court with the registration of such removal.</div>
<div class="clause l1">Any appointment of a Trustee will only be valid and effective from the date that the Master of the High Court has issued a Letters of Authority authorising such appointment. A newly appointed Trustee must, however, be allowed to perform those functions that will allow them to obtain the Master of the High Court’s authority and must be allowed to maintain and conserve Trust Property while the authority is pending.</div>
<div class="clause l1">Any resignation by, retirement, or removal of a Trustee will be valid and effective from the date that such resignation by, retirement, or removal of a Trustee has been lodged with the Master of the High Court and proof is obtained that the resignation by, retirement, or removal of a Trustee has been lodged with the Master of the High Court. Upon their resignation, a Trustee is not absolved from any liability incurred while they were a Trustee.</div>
<div class="clause l0">TRUST PROPERTY TO VEST IN TRUSTEES</div>
<div class="clause l1">On acceptance by the Trustees of their trusteeship and the initial donation in terms of this Trust Deed, the Trustees have a claim against the Founder for the delivery of such donation, upon receiving the Letters of Authority from the Master of the High Court, and have the right and are bound to ensure that they receive the donation.</div>
<div class="clause l1">While this Trust is in operation, the Trustees are hereby obliged to take possession of the Trust Property, including all documents, and to ensure their preservation and safekeeping for the duration of this Trust and for as long as South African law requires.</div>
<div class="clause l1">Upon any Person ceding, selling, or transferring any assets, investments, or other property to the Trustees, they shall be excluded from any right, title, and interest therein and the control thereof, and all rights, titles, and interests therein, including every right of negotiation, shall vest in the Trustees in their fiduciary capacities only, subject to the provisions of this Trust Deed.</div>
<div class="clause l1">Howsoever or wherever the Trust Property may be held or registered, it shall be held for this Trust, and at no time shall the Trustees be deemed to acquire for themselves or on their account any contingent and/or vested right or interest in the Trust Property, save insofar as a Trustee may be a Beneficiary of this Trust, and the other Trustees have selected the said Trustee, who is a Beneficiary, to receive any allocation, distribution, vesting, payment or application for the benefit of such Beneficiary, or to use the Trust Property in terms of the provisions of clause 12.4.35 below, and said Beneficiary accepts the allocation, distribution, vesting, payment or application for their benefit, or to use the Trust Property in terms of the provisions of clause 12.4.35 below, subject to the provisions of this Trust Deed, and in particular clause 13.14 below.</div>
<div class="clause l0">TRUSTEES’ DISCRETION</div>
<div class="clause l1">This is a discretionary inter vivos trust and the discretionary powers given or allocated to the Trustees herein are absolute and unfettered, subject to the provisions of this Trust Deed.</div>
<div class="clause l1">The Trustees may at all material times allocate, distribute, vest, or pay to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or apply for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), any Income, net Income, profits, capital gains, and/or Trust Property, or any portion thereof, or allow the use of Trust Property in terms of the provisions of clause 12.4.35 below, as and when they in their sole, absolute and unfettered discretion may consider fit. The Trustees may also withhold any Income, net Income, profits, capital gains, and Trust Property, or any portion thereof, from any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), and withhold the use of Trust Property by a Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) in terms of the provisions of clause 12.4.35 below, in their sole, absolute and unfettered discretion. </div>
<div class="clause l1">Nothing would in terms of this Trust Deed, or any law, have the effect or result that any Income, net Income, profits, capital gains or Trust Property, or any portion thereof, whether directly or indirectly, or the use of Trust Property in terms of the provisions of clause 12.4.35 below, will vest in any Beneficiary, without such vesting being approved by the board of Trustees in terms of this Trust Deed. Notwithstanding anything contained in this Trust Deed to the contrary, none of the Beneficiaries will have any vested right in any of the Trust Property, or a right to claim distribution from the Trustees, regardless of whether a Beneficiary has historically received benefits from this Trust. </div>
<div class="clause l1">The Trustees are not obliged to favour or benefit Beneficiaries and/or the classes of Beneficiaries equally out of the Income, net Income, profits, capital gain and/or Trust Property, or any portion thereof, or the use of Trust Property in terms of the provisions of clause 12.4.35 below.</div>
<div class="clause l0">DUTIES AND LIABILITIES OF TRUSTEES</div>
<div class="clause l1">The Trustees for the time being of this Trust, and any other Person appointed (who accepted their appointment) in terms of this Trust Deed as Trustee, undertake to carry out their duties and functions and to exercise the powers afforded to them in terms of the relevant South African laws and the provisions of this Trust Deed, with the level of care, diligence, skill, impartiality and good governance, which can reasonably be expected of a Person who manages the affairs of another. The Trustees in particular undertake:</div>
<div class="clause l2">in respect of Trust assets, to make such assets clearly identifiable as Trust assets in a duly compiled asset register;</div>
<div class="clause l2">if applicable, to register Trust Property or to keep the Trust Property registered in such a manner to make it clear from the registration that it is a Trust asset;</div>
<div class="clause l2">to make any account or investment at a financial institution identifiable as a Trust account or Trust investment;</div>
<div class="clause l2">to open a separate Trust account at a banking institution in terms of the powers granted in terms of the provisions of clause 12.4.1 below, and to deposit all money which they may receive, in their capacities as Trustees, therein, subject to the provisions of clause 15.4 and clause 23.6 below;</div>
<div class="clause l2">to keep all and any documentation pertaining to all the affairs of this Trust, in a proper and orderly manner, for the period as specified in the Trust Property Control Act 57 of 1988, as amended;</div>
<div class="clause l2">to indicate clearly in their bookkeeping that the Trust Property is held by them in their capacities as Trustees;</div>
<div class="clause l2">to cause proper records and books of account to be kept of the business and affairs of this Trust and the Trustees’ administration thereof, which records and books shall be in the custody of such Person as is designated by the Trustees from time to time, on behalf of the Trustees, in terms of the provisions of clause 23 below;</div>
<div class="clause l2">to promptly account to the Master of the High Court if the Trustees are called upon to do so; and</div>
<div class="clause l2">to furnish the Master of the High Court with their addresses and any change of same within a period as specified in the Trust Property Control Act 57 of 1988, as amended, of such change, which should initially agree with the information provided in clause 27 below.</div>
<div class="clause l1">The Trustees shall, in carrying out their duties:</div>
<div class="clause l2">always act and exercise their powers within the ambit and scope of this Trust Deed, the Trust Property Control Act 57 of 1988, as amended, and other relevant South African laws;</div>
<div class="clause l2">comply with the terms of and do all that is necessary to maintain in full force and effect all authorisations, approvals, licences, and consents required in or by applicable laws to enable them lawfully to enter into and to perform their obligations in terms of this Trust Deed, and to ensure the legality and enforceability of this Trust Deed;</div>
<div class="clause l2">always act and exercise their powers for the proper purposes as envisaged in, and subject to, the provisions of this Trust Deed;</div>
<div class="clause l2">exercise their discretion in an unfettered manner, subject to the provisions of this Trust Deed, the Trust Property Control Act 57 of 1988, as amended, and other relevant South African laws;</div>
<div class="clause l2">not use, benefit, or profit from any confidential information disclosed to them in their capacities as Trustees;</div>
<div class="clause l2">do all things necessary to exercise the rights and perform the obligations of this Trust;</div>
<div class="clause l2">avoid at all costs any conflict of interest with the business of this Trust;</div>
<div class="clause l2">act independently and impartially;</div>
<div class="clause l2">properly ensure that the stipulated number of Trustees are appointed and authorised in terms of the provisions of clause 7.2 above; and</div>
<div class="clause l2">implement and execute the necessary and proper controls to ensure that the financial and general objectives of this Trust are consistently achieved.</div>
<div class="clause l1">Subject to the provisions of the Trust Property Control Act 57 of 1988, as amended, and specifically that of Section 9(1), no Trustee shall be answerable for any act, omission, negligence, fraud or improper investment of any other Trustee, attorney, accountant, independent contractor or agent employed by the Trustees, except for their own personal and wilful fraud or dishonesty, unless they were privy thereto, and the Trustees indemnify one another against any liability. </div>
<div class="clause l1">The Trustees are indemnified by and from this Trust and the Trust Property against any loss, damage, or claim whatsoever which might arise against them or any of them out of the bona fide administration by them of this Trust.</div>
<div class="clause l0">EXEMPTION TO FURNISH SECURITY</div>
<div class="clause l1">The Trustees shall be exempt from any obligation to furnish security in connection with their appointments and/or for the due administration of this Trust, to the Master of the High Court or any other Person as provided for in any relevant South African laws and the Master of the High Court and any such other Persons are hereby directed to dispense with such security requirements.</div>
<div class="clause l0">POWERS OF TRUSTEES</div>
<div class="clause l1">The Trustees will perform the powers and duties that they have in terms hereof and shall have all the powers that are required or allowed in law, including the powers of assumption, subject to the terms of this Trust Deed.</div>
<div class="clause l1">The Trustees are, save as otherwise expressly provided for herein, empowered to deal with the Trust Property as they in their sole, absolute, and unfettered discretion may deem necessary and/or beneficial in the furtherance of the objectives of this Trust and for that purpose, in addition to all powers enjoyed by them under the common law or by statute, are empowered to exercise all powers relative thereto, as if they were the absolute owners of the Trust Property, and generally to perform all acts to the same extent and with the same effect as the Founder might have done if this Trust Deed had not been executed, and the Trustees’ decisions and actions, whether actually made or taken in writing or implied from their acts, shall be conclusive and binding on all Beneficiaries. </div>
<div class="clause l1">In exercising their specific powers in terms of the provisions of clause 12.4 below, the Trustees shall have the following general powers:</div>
<div class="clause l2">in the event of the Trustees obtaining the necessary approval from the relevant legal authority, to hold the Trust Property, or any part thereof, in or to transfer the administration and management of the Trust Property, or any part thereof, to any country in the world;</div>
<div class="clause l2">to hold the whole or any part of the Trust Property in the name of this Trust, or in their names, or in the names of any other Persons nominated by them for that purpose;</div>
<div class="clause l2">subject to specific terms in this Trust Deed to the contrary, to retain and allow the Trust Property, or any part thereof, to remain in the present state of investment thereof for so long as they think fit;</div>
<div class="clause l2">to contract on behalf of this Trust and to adopt or reject contracts made on behalf, or for the benefit, of this Trust;</div>
<div class="clause l2">to employ and pay out of this Trust any other Person or other Persons to do any act or acts, although the Trustees, or any of them, could have done any such act or acts;</div>
<div class="clause l2">to determine whether any sums disbursed are on account of capital or income, or partly on account of one and partly on account of the other, and in what proportions;</div>
<div class="clause l2">to determine whether any surplus on the realisation of any asset or the receipt of any dividends, distribution, or bonus or capitalisation shares, together with its associated costs, be regarded as on income or capital account; and</div>
<div class="clause l2">to do all or any of the below things and to exercise all or any of the below rights and powers in the Republic of South Africa, or in any other part of the world.</div>
<div class="clause l1">The Trustees shall have the following specific powers, subject to the terms of this Trust Deed and any applicable law:</div>
<div class="clause l2">to open and operate any banking account or facility for this Trust in terms of the provisions of clause 23.6 below, apply for any credit or debit cards, to receive deposits, promissory notes, and/or bills of exchange, and attend to any of the latter by electronic, telephonic, or internet means, as approved by the Trustees in terms of this Trust Deed, subject to the provisions of clause 15.4 below;</div>
<div class="clause l2">to accept and acquire or reject for the purpose of this Trust any gifts, bequests, grants, donations, or inheritances from any Person or estate (and enter into redistribution agreements in respect of any inheritances on behalf of this Trust), or payments from any Person that may be given, bequeathed or paid to them as an addition, or with the intention to add to the assets hereby donated to them;</div>
<div class="clause l2">to accept and receive or reject payments from any retirement fund (any approved pension, provident, preservation, and/or retirement annuity fund) on behalf of any Beneficiary of this Trust who has been identified as a dependant (which bears the same meaning, in relation to a deceased member of a retirement fund, as the definition of “dependant” in the Pension Funds Act 24 of 1956, as amended) of a deceased member of that retirement fund, and/or a nominee (which bears the same meaning, in relation to a deceased member of a retirement fund, as the wording used in Section 37C of the Pension Funds Act 24 of 1956, as amended) of such a dependant. When agreeing to accept such payment from such approved retirement fund, the Trustees will provide the trustees of that retirement fund with a written undertaking/resolution whereby they formally agree to abide by the apportionment of funds allocated to such Beneficiary and to ensure that both the allocated capital amount as well as any income relating to that capital amount, cumulatively referred to as the retirement fund benefit, will be invested, administered and eventually distributed to such Beneficiary. Should such Beneficiary pass away before the final distribution of the retirement fund benefit such retirement fund benefit allocated to them will devolve upon their heirs as indicated in their will and failing a valid will, in their heirs in terms of the law of intestate succession;  </div>
<div class="clause l2">to acquire, dispose of, invest in, exchange, and/or barter movable or immovable, whether corporeal or incorporeal, assets, and to sign and execute all requisite documents and to do all things necessary for the purposes of effecting and registering, if needs be, the transfer according to the law of any such assets. In exercising any powers of sale, whether conferred in this sub-clause or otherwise, they shall be entitled to cause such sale to be effected by public auction or by private treaty and in such manner and on such terms and conditions as they in their sole, absolute and unfettered discretion may deem fit;</div>
<div class="clause l2">to demolish, improve, alter, repair, and maintain any movable and immovable Trust Property, to develop immovable property by erecting buildings thereon or otherwise, and to expend the Income, profit, capital gains, and/or Trust Property, or any portion thereof, for the preservation, maintenance, and upkeep of such property as they may consider fit;  </div>
<div class="clause l2">to let or hire any movable or immovable, whether corporeal or incorporeal, assets, to collect rent, cancel leases, and to evict a lessee from property belonging to this Trust and in exercising any powers of lease they shall be entitled to cause any property to be let at such rental, for such period and on such terms and conditions as they, in their sole, absolute and unfettered discretion may deem fit;  </div>
<div class="clause l2">to incorporate any Company, or establish a trust in any place in the world at the expense of this Trust with limited or unlimited liability for the purpose of inter alia, acquiring the whole or any part of the Trust Property. The consideration on the sale of the assets of this Trust, or any part thereof, to any Company incorporated under this sub-clause, may consist of wholly or partly paid debentures or debenture stock or other securities of such Company, and may be credited as fully paid and may be allotted to or otherwise be vested in the Trustees and be Trust Property in the hands of the Trustees; </div>
<div class="clause l2">to invest in and dispose of shares, memberships, stocks, debentures, unit trusts, warrants, options, bonds, securities, promissory notes, bills of exchange, and other negotiable instruments, to subscribe to the memorandum of incorporation of, and apply for shares in, any Company, and in the event of a Company or a unit trust scheme prohibiting, in terms of its memorandum of incorporation or regulations, the transfer of shares or units into the name of this Trust as such, the shares or units shall be registered in their names or the names of their representatives and shall be held as nominees on behalf of this Trust; </div>
<div class="clause l2">to unanimously appoint or cause to be appointed, or to unanimously remove any one or more of themselves, or their nominees, as directors or officers of any Company, whose shares form a portion of the Trust Property, in terms of the provisions of clause 13.9.6 below, with the obligation to pay remuneration for their services as directors and other officers received to this Trust. Should more than 1 (one) Trustee be appointed as directors of such a Company, then they shall unanimously act as a voting pool at all times;</div>
<div class="clause l2">to exercise the voting power attached to any share, stock, debenture, security, interest, or unit in any Company in which the share, stock, debenture, security, interest, or unit is held, in such manner as they may deem fit, and to take such steps or enter into such agreements with other Persons as they may deem fit, for the purposes of amalgamation, merger of or compromise in any Company in which the share, stock, debenture, security, interest or unit is held;</div>
<div class="clause l2">to exercise and take up and realise any rights of conversion or subscription attaching, or relating to any share, stock, interest, debenture, or unit forming part of the Trust Property; </div>
<div class="clause l2">to consent to any re-organisation, arrangement, or reconstruction of any Company, the securities of which form the whole or any part of the Trust Property and to consent to any reduction of capital or other dealings with such securities as they may consider advantageous or desirable;</div>
<div class="clause l2">to purchase and dispose of membership in a Close Corporation, subject to the statutory requirements in terms of the Close Corporations Act 69 of 1984, as amended; </div>
<div class="clause l2">to enter into any partnership, joint venture, conduct of business, or other association with any other Person for the doing or performance of any transaction or series of transactions within the powers of the Trustees in terms hereof, and/or to acquire and/or hold and/or dispose of any assets in co-ownership or partnership with any Person; </div>
<div class="clause l2">to borrow money, to discharge any liability of this Trust and/or to pay income tax and/or to make payment of an unpaid distribution, or vesting, or any portion thereof, to any Beneficiary and/or to make a loan to any Beneficiary and/or to make an investment and/or to preserve or improve any asset or investment of this Trust and/or to conduct any type of business and/or to provide any type of services on behalf of this Trust and/or for any other purpose deemed necessary or desirable by the Trustees, at such time or times, at such rate of interest or other consideration for any such loan and upon such terms and conditions as they may deem desirable. Such borrowings may be made from any suitable Person or Persons. Any such loan or loans may be extended, renewed, or repaid as the Trustees may deem to be in the best interest of this Trust; </div>
<div class="clause l2">to mortgage, pledge, hypothecate or otherwise encumber any of the Trust Property, or secure a payment of any amount by any other security device, provided it benefits this Trust, and to execute any act or deed relating to alienation, partition, exchange, transfer, mortgage, hypothecation or otherwise, in any deeds registry, mining titles office or other public office dealing with servitudes, usufructs, limited interests or otherwise; and to make any applications, grant consents, and agree to any amendments, variations, cancellations, cessions, releases, reductions, substitutions or otherwise generally relating to any deed, bond, or document for any purpose and generally to do or cause to be done any act whatsoever in any such office;</div>
<div class="clause l2">to appear before the Registrar of Deeds, conveyancer, or other proper officer of the law, and to execute any Mortgage Bond or Deed of Hypothecation as security for loans of money or as security for any other indebtedness or obligation contracted on this Trust’s behalf;</div>
<div class="clause l2">to appear before any Notary Public and to execute any Notarial Deed with regards to Trust Property;</div>
<div class="clause l2">to obtain and utilise in the name of this Trust, membership in and any credit facilities from any agricultural or other society and for this purpose to encumber the Trust Property, or any portion thereof, by way of pledge, hypothec, or mortgage as security; </div>
<div class="clause l2">to guarantee the obligations of any Beneficiary, directly or indirectly, to enter into indemnities and to bind this Trust as surety for, and/or co-principal debtor in solidum with any Beneficiary, directly or indirectly, in respect of any debt or obligation of that Beneficiary, directly or indirectly, whether for consideration or gratuitously on such terms as they consider fit, including the renunciation of the benefits of excussion and division. The Trustees shall be entitled in respect of any obligations or liabilities so assumed by them to pledge, mortgage, cede in security, or otherwise encumber all or any part of the Trust Property in such manner and subject to such terms and conditions as they shall deem fit as collateral for such obligations, as long as such actions are in line with the purpose and objectives of this Trust;</div>
<div class="clause l2">to lend money on such terms and at such interest, and to such Persons, as the Trustees may determine, and with or without security as the Trustees may determine, as long as such loans are made to the benefit of this Trust, or to one or more of the Beneficiaries, in alignment with the purpose and objectives of this Trust;</div>
<div class="clause l2">to allow time for the payment of debts due to them and grant credit in respect of the whole or any part of the purchase price arising on the sale of any portion of the Trust Property, in either case with or without security and with or without interest, as the Trustees may think fit, as long as it is to the benefit of this Trust or one or more of the Beneficiaries;</div>
<div class="clause l2">to sue for, recover, and receive all debts or sums of money, goods, effects, and things, which are due, owing, payable, or belong to this Trust, and to institute any action in any forum to enforce any benefits or rights on behalf of this Trust;</div>
<div class="clause l2">to institute or defend, oppose, compromise, or submit to arbitration all accounts, debts, claims, demands, disputes, legal proceedings, and matters which may subsist or arise between this Trust and any other Person;</div>
<div class="clause l2">to attend all meetings of creditors of any Person indebted to this Trust, whether in sequestration, liquidation, business rescue, or otherwise, and to vote for the election of a trustee and/or liquidator and/or business rescue practitioner and to vote on all questions submitted to any such meetings of creditors and generally to exercise all rights afforded to a creditor;</div>
<div class="clause l2">to conduct or carry on any business or to provide any type of services on behalf of and for the benefit of this Trust, and to employ the Trust Property, in the conduct of any such business;</div>
<div class="clause l2">to treat as income or capital any periodic receipts received from wasting assets, without being required to make provision for the amortisation of the same;</div>
<div class="clause l2">to give receipt, releases or other effectual discharges for any sum of money or thing recovered or received;</div>
<div class="clause l2">to determine what shall be treated as income or capital in respect of any liquidation dividend or return of capital in the case of Companies or Close Corporations, whose shares or memberships are being held as Trust Property by the Trustees; </div>
<div class="clause l2">to engage the services of professional practitioners, agents, independent contractors, and tradesmen for the performance of work and rendering of services necessary or incidental to the Trust Property or the affairs of this Trust;</div>
<div class="clause l2">to pay any Costs incurred in the administration of this Trust;</div>
<div class="clause l2">to pay all rates, taxes, duties, and other impositions lawfully levied or imposed on the Trust Property, Income, profits, and/or capital gains of this Trust, or any portion thereof, or which may be imposed on the Trustees in respect of matters arising out of this Trust, and to refund any rates, taxes, duties and other impositions lawfully levied or imposed on any other Person in terms of clause 20 below;  </div>
<div class="clause l2">to effect an assurance policy on the life of the Founder, a Trustee, and/or a Beneficiary, to continue any such policy and/or to surrender, redeem, dispose of, encumber, and borrow against any such policy, or to take cession of such policy, with the right generally to deal with any such policy as they in their sole, absolute and unfettered discretion deem fit, and to pay the premiums;  </div>
<div class="clause l2">to effect a short-term insurance policy for insuring this Trust’s assets or against a risk that this Trust or the Trustees may be exposed to, and to pay the premiums;   </div>
<div class="clause l2">to allow any Beneficiary and/or Spouse, parent, Descendant,  and/or guardian, (if such a Beneficiary is still a Minor) of such Beneficiary, and/or the Founder and/or their Spouse, to occupy or use any Trust Property, free of charge or at a cost, and upon such further terms and conditions as the Trustees may decide, including who will be liable for the maintenance, rates, insurance premiums, municipal costs and other charges related to or arising from the ownership or possession of the Trust Property so being occupied or used, in terms of the provisions of clause 5.3 above;</div>
<div class="clause l2">to make donations for charitable, ecclesiastical, educational, or other like purposes in terms of the provisions of clause 18.2 below; </div>
<div class="clause l2">to approve and/or pay and/or transfer distributions or vestings of Income, net Income, profits, capital gains, and/or Trust Property, or any portion thereof, in terms of this Trust Deed and in particular in terms of the provisions of clause 18 below;</div>
<div class="clause l2">to appoint and remove Trustees in terms of the provisions of clause 7 above;</div>
<div class="clause l2">to amend this Trust Deed in terms of the provisions of clause 24 below; and</div>
<div class="clause l2">to deregister this Trust in terms of the provisions of clause 25 below.</div>
<div class="clause l0">DECISIONS OF TRUSTEES</div>
<div class="clause l1">The Trustees may meet together for the dispatch of business, adjourn, and otherwise regulate their meetings in terms of the provisions of this clause 13. The Trustees shall meet, physically or virtually, at least once a year.</div>
<div class="clause l1">Any Trustee may, subject to the provisions of clause 13.3 below, at any time, summon a meeting of Trustees, whether physical or virtual.</div>
<div class="clause l1">All meetings shall be convened at all times, on no less than 14 (fourteen) days’ written notice, to all Trustees; provided that shorter notice may be given if, in the reasonable opinion of the majority of Trustees, an urgent decision of the Trustees is required. Such notice shall be given either by courier, registered mail, email, or by hand as per clause 27 below. Any notice to convene a meeting of Trustees shall contain an agenda of the matters to be considered together with any proposed motions.</div>
<div class="clause l1">The Trustees may, if certain Trustees cannot personally attend a meeting, confer by radio, telephone, closed-circuit television, or other electronic means of audio or audio-visual communication. Notwithstanding that the Trustees are not physically present together in one place at the time of the conference, a resolution passed by the Trustees constituting a quorum at such a conference shall, provided such resolution is recorded in writing and signed (manually or digitally) by all Trustees, be deemed to have been passed at a meeting of the Trustees held on the day on which and at the time at which the conference was held. The provisions of this Trust Deed relating to proceedings of Trustees apply so far as they are capable of applying mutatis mutandis to such conferences.</div>
<div class="clause l1">The quorum for any meeting of Trustees shall be all the Trustees (or their proxies). Subject to the provisions of clause 13.6 below, if, within 30 (thirty) minutes from the time stipulated for a meeting, a quorum is not present, the meeting shall automatically stand adjourned to the same day the following week at the same time and place, however, if that day is a public holiday, Saturday or a Sunday, then to the next succeeding day other than a public holiday, Saturday or Sunday. If at such adjourned meeting a quorum is not present within 30 (thirty) minutes, the Trustees (or their proxies) then present shall be a quorum. No business may be concluded at the adjourned meeting, save for business specified on the agenda as per clause 13.3 above. This clause is subject to the requirement that a Trustee, who is also a Beneficiary, or their proxy, must always be present for a quorum to be validly constituted and no business may be concluded unless this condition is complied with. Any obstructive behaviour of any Trustee shall be dealt with in terms of the provisions of clause 14 below.</div>
<div class="clause l1">Although all Trustees should make an effort to attend Trustee meetings, any Trustee shall be entitled to appoint any other Person (including one of the other Trustees), in writing, to act and vote on their behalf at any meetings of the Trustees. Such proxy shall merely convey the input and vote of the represented Trustee, in writing, and shall not be allowed to provide their own input and/or cast their vote.</div>
<div class="clause l1">The Trustees may from time to time elect a chairperson to hold office for such period or periods as they may determine. The chairperson shall not have a casting vote. The Trustees (or their proxies) present at the meeting shall each have 1 (one) vote.</div>
<div class="clause l1">Save as may be otherwise provided in this Trust Deed, and the law, all decisions regarding the day-to-day affairs of this Trust shall be by way of a majority vote. Should there only be 2 (two) Trustees, both Trustees have to agree to any decision. Even though a majority vote is allowed in this Trust Deed, all Trustees, including dissenting Trustees, shall at all times sign all resolutions of this Trust.</div>
<div class="clause l1">Notwithstanding anything else to the contrary contained in this Trust Deed, for any of the following decisions to be effective, the unanimous decision of all Trustees (and other Persons, where relevant) is required:</div>
<div class="clause l2">the interpretation of this Trust Deed in terms of the provisions of clause 2.37 above;</div>
<div class="clause l2">the change of the name of this Trust in terms of the provisions of clause 3.2 above;</div>
<div class="clause l2">the appointment of an additional Trustee in terms of the provisions of clause 7.9 above; </div>
<div class="clause l2">the appointment of a replacement Trustee in terms of the provisions of clause 7.10 above;</div>
<div class="clause l2">the removal of a Trustee in terms of the provisions of clause 7.12.9 above; </div>
<div class="clause l2">the appointment and removal of Trustee/s, or their nominees, as directors or officers of any Company, whose shares form a portion of the Trust Property, in terms of the provisions of clause 12.4.9 above;</div>
<div class="clause l2">the appointment of a mediator or arbitrator in terms of the provisions of clause 14 below, in the event of the Trustees not being able to make a unanimous decision and/or execute a decision as envisaged in this Trust Deed, and in particular clause 13.11 below;</div>
<div class="clause l2">the approval of minutes of meetings in terms of the provisions of clause 13.12 below;</div>
<div class="clause l2">the appointment of signatories to sign Trust documents in terms of the provisions of clause 15.3 below;</div>
<div class="clause l2">the allocation of powers for the approval of any bank transactions in terms of the provisions of clause 15.4 below;</div>
<div class="clause l2">the contracting with a Trustee, or any firm of which they are a member or partner, or any Person that a Trustee is interested in or connected to, in terms of the provisions of clause 16.3 below;</div>
<div class="clause l2">remuneration payable to Trustees in terms of the provisions of clause 17.2 below;</div>
<div class="clause l2">a distribution or vesting, in aggregate, or loan for an amount in excess of 25.0% (twenty-five percent) of the Trust Property to any one Beneficiary in terms of the provisions of clause 18.4 below; </div>
<div class="clause l2">the limitation of the extent of the participation in allocations, distributions, vestings, and payments under this Trust in terms of the provisions of clause 18.13 below;</div>
<div class="clause l2">the approval of the cession, assignment, pledge, disposal, or alienation of the contingent rights or hopes, or vested rights, of Beneficiaries in terms of the provisions of clause 19.4 below;</div>
<div class="clause l2">the depositing of trust money into an account, other than a Trust bank account, in terms of the provisions of clause 23.6 below;</div>
<div class="clause l2">the amendment of this Trust Deed in terms of the provisions of clause 24 below; and</div>
<div class="clause l2">the deregistration of this Trust in terms of the provisions of clause 25 below.</div>
<div class="clause l1">The provisions of clause 15.6 to clause 15.8 below have to be followed for a resolution or decision to be valid and effectual.</div>
<div class="clause l1">If a decision cannot be reached by the Trustees, as aforementioned, or any one or more Trustee is/are obstructive in any decision-making and/or execution of any decision duly taken in terms of the provisions of this clause 13, the matter shall be dealt with in terms of the provisions of clause 14 below.</div>
<div class="clause l1">The Trustees shall keep minutes of their meetings in writing, and all resolutions passed by the Trustees at such meetings shall be duly minuted. The Trustees shall circulate the draft minutes between all the Trustees within 7 (seven) days of the meeting. Trustees shall provide their feedback, if any, on such minutes within a further 7 (seven) days of receipt of the draft minutes. Failure by a Trustee to comment on the draft minutes shall be deemed an agreement by such Trustee with their correctness. The final consolidated minutes have to be approved by all Trustees, digitally, by email, or in writing, within a further 7 (seven) days, in terms of the provisions of clause 13.9.8 above. Should all Trustees not approve the final minutes, the matter shall be dealt with in terms of the provisions of clause 13.11 above.</div>
<div class="clause l1">The Trustees shall, either at a meeting, or through a round-robin resolution in terms of the provisions of clause 15.6 below (before a Financial Year-end of this Trust as envisaged in clause 23.4 below), within their sole, absolute, and unfettered discretion decide upon the allocations, distributions, vestings, and/or payments to Beneficiaries, or application for their benefit, of Income, net Income, profits, and/or capital gains, which were earned by or which accrued to this Trust during that Financial Year. </div>
<div class="clause l1">Notwithstanding anything else to the contrary contained in this Trust Deed, no Trustee shall at any time qualify as an Income Beneficiary or Capital Beneficiary or receive any benefits as such for so long as they are, on their own, competent to appropriate or dispose of Trust Property for their benefit or for the benefit of their estate (directly or indirectly) in the spirit and wording of the provisions of Section 3(3)(d) of the Estate Duty Act 45 of 1955, as amended, nor shall they have or be competent to obtain such power directly or indirectly by the exercise, whether with or without notice, of any power exercisable by them or with their consent, nor shall they be party to any decision which directly or indirectly affects the distribution or vesting of Trust Property to them or their estate (directly or indirectly), which decision may be taken by the other Trustees as per this Trust Deed. However, should there only be 2 (two) Trustees in office, then a distribution or vesting to such Trustee, who is a Beneficiary, shall be made by both Trustees unanimously. In the event of any doubt, this clause will have preference to any other clause in this Trust Deed.</div>
<div class="clause l1">In terms of the provisions of clauses 2.5 and 2.12 above, unborn children shall not be recognised as having any rights under this Trust Deed or to the Income, net Income, profits, capital gains or Trust Property, or any portion thereof, and the Trustees shall not be required to take any account of unborn children in their administration of this Trust or any decision affecting this Trust, including any decision to amend this Trust Deed in terms of the provisions of clause 24 below and any decision to deregister this Trust in terms of the provisions of clause 25 below.</div>
<div class="clause l0">DISPUTES, DISAGREEMENTS AND DEADLOCKS</div>
<div class="clause l1">The Founder (where relevant), Trustees and Beneficiaries (where relevant) shall be subjected to the provisions of this clause 14.</div>
<div class="clause l1">The Founder (where relevant), Trustees and Beneficiaries (where relevant) shall firstly attempt, in good faith, to settle their disputes and disagreements amongst themselves.</div>
<div class="clause l1">If no decision can be reached, as envisaged in this Trust Deed, and in particular the provisions of clause 14.2 above, the Founder (where relevant), the Trustees, and Beneficiaries (where relevant) will attempt to resolve a dispute, disagreement, or deadlock through mediation. The mediation shall take place in South Africa and shall be conducted in accordance with the laws of the Republic of South Africa. The  Founder (where relevant), Trustees, and Beneficiaries (where relevant) shall unanimously agree on a mediator within 5 (five) business days, since the dispute arose. Should the mediator be unable to accept the invitation to act as mediator, the Founder (where relevant), Trustees, and Beneficiaries (where relevant) may, within a further 5 (five) business days period, agree on another mediator. If the Founder (where relevant), Trustees, and Beneficiaries (where relevant) are unable to agree on a mediator (initially or with the appointment of the second mediator) within a further 5 (five) business days period, then the Founder (where relevant), any Trustee or any Beneficiary (where relevant) may approach the Chairperson of the Association of Arbitrators, Southern Africa (“AoA”), to submit to the Founder (where relevant), each Trustee and each Beneficiary (where relevant) a list of names of potential mediators. The Founder (where relevant), Trustees and Beneficiaries (where relevant) will from date of receipts of this list have a 5 (five) business days period within which to agree on a mediator. Should they be unable to agree, the AoA will be asked to appoint a suitable mediator as a matter of urgency.</div>
<div class="clause l1">The mediator shall endeavour to assist the Founder (where relevant), Trustees, and Beneficiaries (where relevant) to settle the dispute by agreement. The mediator shall not adjudicate the dispute, disagreement, or deadlock, make any recommendations to the Founder (where relevant), Trustees, and Beneficiaries (where relevant), or advise the Founder (where relevant), Trustees, and Beneficiaries (where relevant) on the merits of the dispute, disagreement or deadlock. The mediator shall have the discretion to conduct the mediation in such a manner as they determine. The mediator shall be responsible for the administration of the mediation, including the process and conduct of the mediation, which shall be done in an expeditious and cost-effective manner. </div>
<div class="clause l1">Before and during the scheduled mediation session(s), the Founder (where relevant), Trustees, and Beneficiaries (where relevant) shall, as appropriate to each of the Founder’s (where relevant), Trustees’ and Beneficiaries’ (where relevant) circumstances, exercise their best efforts to prepare for and engage in meaningful and productive mediation. </div>
<div class="clause l1">Every Person involved in the mediation: </div>
<div class="clause l2">shall keep confidential all information arising out of or in connection with the mediation, including the fact that the mediation is to take place or has taken place and the facts and terms of any settlement, unless disclosure is required by law to implement or to enforce the terms of settlement; and </div>
<div class="clause l2">acknowledges that all such information passing between the Founder (where relevant), Trustees and Beneficiaries (where relevant), and the mediator is agreed to be without prejudice to any party’s legal position, and may not be produced as evidence or disclosed to any judge, arbitrator or other decision-maker in any legal or other formal process, except where otherwise disclosable in law. </div>
<div class="clause l1">Before the commencement of mediation, the parties to the mediation will obtain an undertaking in writing by the mediator that they agree that where  the Founder (where relevant),  a Trustee, and/or a Beneficiary (where relevant) privately discloses to them any information in confidence, before, during, or after the mediation, they will not disclose that information to any other Person, without the consent of the Founder (where relevant), Trustees and/or Beneficiaries (where relevant) disclosing it, unless required by law to make disclosure. </div>
<div class="clause l1">The Founder (where relevant), Trustees, and/or Beneficiaries (where relevant) will not call the mediator as a witness, nor require the mediator to produce in evidence any records or notes relating to the mediation, in any litigation, arbitration, or other formal process arising from or in connection with their dispute and the mediation; nor will the mediator act or agree to act as a witness, expert, arbitrator or consultant in any such process. </div>
<div class="clause l1">If the Founder (where relevant), Trustees, and Beneficiaries (where relevant) settle the dispute, disagreement, or deadlock, or any part thereof, in a settlement agreement, then that settlement agreement shall be a final and binding settlement of the dispute, disagreement or deadlock, or such part thereof, as applicable. </div>
<div class="clause l1">The mediation of a dispute shall terminate when: </div>
<div class="clause l2">the mediator receives written notice from the Founder (where relevant), a Trustee, and/or a Beneficiary (where relevant) stating that the Founder (where relevant), Trustee, and/or Beneficiary (where relevant) withdraws from the mediation, provided that no party shall withdraw from the mediation without first orally notifying the mediator and giving the mediator an opportunity to mediate on that party’s continued participation in the mediation; </div>
<div class="clause l2">the mediator advises the Founder (where relevant), Trustees, and Beneficiaries (where relevant) in writing that they believe that there are no reasonable prospects of settlement in the mediation; or</div>
<div class="clause l2">the Founder (where relevant), Trustees and Beneficiaries (where relevant) conclude a written settlement agreement, provided that they agree to continue the mediation in the event that any part of the dispute remains unsettled, after the conclusion of the settlement agreement.</div>
<div class="clause l1">The cost of mediation shall be borne by this Trust. </div>
<div class="clause l1">If a dispute, disagreement, or deadlock is not resolved as envisaged in the sub-clauses supra, it will be submitted to a referee, as unanimously agreed upon by    the Founder (where relevant), the  Trustees, and Beneficiaries (where relevant). Failing agreement between the relevant parties to unanimously appoint such referee within 5 (five) business days after the decision cannot be reached, a referee shall be nominated by the chairperson or acting chairperson of the National Bar Council of South Africa or Legal Practice Council, or its successors in title, through the instruction of the Founder (where relevant), any one Trustee or Beneficiary (where relevant). Such Person shall be an advocate or attorney with at least 10 (ten) years’ experience in this field of the law. </div>
<div class="clause l1">The Founder (where relevant), every  Trustee, and every Beneficiary (where relevant) shall be entitled to appear personally or by a single agent, duly appointed, but without any legal or other professional assistance before the referee, and the proceeding shall be conducted as informally as possible. The referee, at their discretion, shall determine the procedure to be followed. </div>
<div class="clause l1">All costs incurred during this process shall be borne by this Trust, save in the event of the referee being of the opinion that the Founder (where relevant), any one or more Trustee and/or any one or more Beneficiary (where relevant), has/have acted in a trivial, vexatious, obstructive or unreasonable manner, in which event the referee may award that such Founder, Trustee/s and/or Beneficiary/ies bear/s the costs of any matter that has been referred.</div>
<div class="clause l1">The decision of the referee shall be final and binding on the relevant parties and no party shall make such decision the subject of any legal proceedings, and such decision shall be deemed a decision of the relevant parties, made in terms of this Trust Deed.</div>
<div class="clause l0">SIGNING POWERS AND POWERS OF APPROVAL</div>
<div class="clause l1">The Trustees are authorised to enter into, negotiate, execute, and sign any document, contract, agreement, instrument, negotiable instrument, bill of exchange, deed, memoranda, memorandum of incorporation, shareholders agreement, and any prescribed form in any statute to achieve the purpose and objectives of this Trust in terms of the provisions of this Trust Deed.</div>
<div class="clause l1">The Trustees, in their administration of this Trust, and to enable them to give effect to any formal legal requirement, may authorise 1 (one) or more of them to sign on behalf of the Trustees all documents required to be signed for the execution of any transaction concerning the business of this Trust, subject to the provisions of clauses 15.3 and 15.4 below.</div>
{{SIGNING_POWERS_CLAUSE}}
{{BANK_APPROVAL_CLAUSE}}
<div class="clause l1">A properly documented and approved resolution is a requirement for any action envisaged in this clause 15.</div>
<div class="clause l1">A resolution in writing, signed by all the Trustees, manually or digitally, (including the signature of several documents to the same effect) on a round-robin basis, shall be valid and effectual as if it had been passed at a meeting of the Trustees duly called and constituted.</div>
<div class="clause l1">Any resolution certified by a Trustee to be a true extract from the minutes of a meeting signed by all the Trustees shall in all respects have the same legal force as a resolution signed by all the Trustees.</div>
<div class="clause l1">All resolutions of the Trustees relating to the allocation, distribution, vesting, or payment, to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or the application for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) of Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof,  or which allow the use of Trust Property in terms of the provisions of clause 12.4.35 above,  shall be reduced to writing and signed by all the Trustees, manually or digitally, subject to the provisions of this Trust Deed, and in particular clause 13 above. No allocation, distribution, vesting, or payment to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or application for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) relating to Income, net Income, profits, capital gains or Trust Property, or any portion thereof,  or the use of Trust Property in terms of the provisions of clause 12.4.35 above, shall be of any force and effect unless reduced to writing and signed per the provisions of this clause, and recorded in the minutes of the meeting of the Trustees, at which the resolution was made, where relevant, subject to the provisions of clause 15.6 above.</div>
<div class="clause l0">TRUSTEES CONTRACTING WITH THIS TRUST</div>
<div class="clause l1">No Trustee, or any firm of which they are a member or partner, or any Person a Trustee is interested in or connected to, shall be automatically disqualified from contracting with this Trust (or any Person this Trust is interested in), nor shall any contract entered into by this Trust (or any Person this Trust is interested in) with such Person, be invalidated or voided because of such relationship, nor shall any Trustee or Person so contracting or being so interested in or acquiring any benefits under any contract entered into with this Trust, or any Person this Trust is interested in, be liable to account to this Trust, or such Person this Trust is interested in, for any profits or benefits realised by or under such contract because of them holding that office, subject to the provisions of clause 16.3 below.</div>
<div class="clause l1">A Trustee or any firm of which they are a member or partner, or any Person which Trustee is interested in or connected to, may be employed to act in any matter relating to this Trust (or any Person this Trust is interested in) and the administration thereof and shall be entitled to charge and be paid for any services rendered by them or their firm in a professional capacity, including acts which any Trustee could have done personally, at the rates normally applicable to such services or acts.</div>
<div class="clause l1">All the Trustees will unanimously agree to accept, reject, or amend any contract entered into with this Trust (or any Person this Trust is interested in) for any professional services so rendered in terms of the provisions of this clause 16, and subject to the provisions of clause 13.9.11 above.</div>
<div class="clause l1">Should a Trustee fail to disclose to the other Trustees their interest in any contract with this Trust (or any Person this Trust is interested in), the Trustee concerned:</div>
<div class="clause l2">may be removed from their office as Trustee by the resolution of the other Trustees to this effect;</div>
<div class="clause l2">will be liable to account to this Trust for any benefit received or profit realised by or arising from the contract if so required by the other Trustees; and/or</div>
<div class="clause l2">the contract may be declared null and void if so decided by the other Trustees. If the contract was entered into with a Person this Trust is interested in, the Trustees may request the decision makers of that Person to declare the contract null and void.</div>
<div class="clause l0">COSTS AND OTHER PAYMENTS</div>
<div class="clause l1">All bona fide Costs incurred by the Trustees in the administration of this Trust, or the exercise of the powers conferred upon them, shall be paid by the Trustees out of the Income, profits, capital gains and/or Trust Property, as decided by the Trustees.</div>
<div class="clause l1">The Trustees may from time to time determine a reasonable remuneration for each Trustee, which shall be paid to them for the administration of this Trust. All Trustees shall unanimously agree to any remuneration so payable, with no requirement to pay the same remuneration to all Trustees, subject to the provisions of clause 13.9.12 above.</div>
<div class="clause l0">ALLOCATIONS, DISTRIBUTIONS, VESTING, PAYMENTS, APPLICATION AND USE OF TRUST PROPERTY</div>
<div class="clause l1">Until the deregistration of this Trust in terms of the provisions of clause 25 below, pending the distribution and vesting as hereinafter provided, none of the Income, net Income, profits, capital gains or Trust Property, or any portion thereof, or the use of Trust Property in terms of the provisions of clause 12.4.35 above, shall be deemed to be attributable to the share or the prospective or contingent share of any Beneficiary, save that the Trustees, may in their sole, absolute and unfettered discretion allocate, distribute, vest, or pay, to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or apply for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), any Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, or allow the use of Trust Property in terms of the provisions of clause 12.4.35 above, (without any real rights or vesting rights to vest in such Person or any form of ownership to pass to such Person), without the requirement to maintain equality between the Beneficiaries and/or the classes of Beneficiaries, subject to the provisions of this Trust Deed, and in particular clauses 12, 13 and 15 above. No Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) shall claim, petition, request, or have any right to demand any vesting, payment or distribution by the Trustees of the Income, net Income, profits, capital gains, or Trust Property, or any portion thereof,  or the use of Trust Property in terms of the provisions of clause 12.4.35 above.</div>
<div class="clause l1">The Trustees will also be empowered to make donations for charitable, ecclesiastical, educational, or other like purposes either from the Income, net Income, profits, capital gains, and/or Trust Property in terms of the provisions of clause 12.4.36 above.</div>
<div class="clause l1">The Trustees shall be entitled to accumulate the whole or any part of such Income, net Income, profit, capital gains, and Trust Property, or any portion thereof, for any period they shall think fit and either retain the same uninvested (without responsibility for any loss) or invest the same in any of the securities or investments authorised in terms of the provisions of clause 12 above. </div>
<div class="clause l1">This entire clause is subject to the requirement that the Trustees shall unanimously agree on any distribution or vesting, in aggregate, or loan to any Beneficiary for an amount in excess of 25.0% (twenty-five percent) of the Trust Property, in terms of the provisions of clause 13.9.13 above. </div>
<div class="clause l1">The Trustees shall in their sole, absolute, and unfettered discretion determine whether any distribution or vesting, which represents the allocation, payment, or application of any capital gain, arising out of the disposal of Trust Property, or a portion thereof, constitutes the vesting of an interest in the capital gain, or a portion thereof, in respect of that disposal for purposes of Paragraph 80(2) of the Eighth Schedule to the Income Tax Act 58 of 1962, as amended, to any Beneficiary irrespective of whether the amount distributed or vested is lower or higher than the amount of the capital gain determined in respect of that disposal in terms of the Eighth Schedule to that Act. </div>
<div class="clause l1">Where Income and/or capital gains are at any time derived from different sources, or are of different kinds, the Trustees shall be entitled, for the purpose of allocating, distributing, vesting, paying, or applying any part of the Income and/or capital gains, to identify their sources and their natures and to allocate, distribute, vest, or pay, to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), or apply for the benefit and Welfare of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) them as Income and/or capital gains derived from the sources and of the natures so identified.</div>
<div class="clause l1">In making an allocation, distribution, vesting, or payment at any time to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) of the Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, in terms of this Trust Deed, the Trustees shall be entitled to make any such allocation, distribution or payment either in cash or in specie, or partly in cash and partly in specie. For this clause, the word “specie” shall be deemed to include any Trust Property, or any portion thereof, which is in a form other than cash. The Trustees may also in their sole, absolute, and unfettered discretion grant the use of any Trust Property to any Person in terms of the provisions of clause 12.4.35 above, with or without consideration therefore. The Trustees’ valuation of any asset distributed or vested by them in specie, in terms hereof, or the granting of the use of any Trust Property, shall be final and binding on all interested parties. </div>
<div class="clause l1">No Beneficiary shall be entitled to anticipate any particular treatment of a distribution or vesting by this Trust or any rights accruing hereunder. Any distribution to, or vesting in, a Beneficiary may be wholly or partly paid or transferred to such Beneficiary personally, applied for the benefit of such Beneficiary, or invested on behalf of such Beneficiary, in any one or more investments, or held under the control of the Trustees as the Trustees consider appropriate, in their sole, absolute and unfettered discretion, in terms of the provisions of clause 18.9 and clause 19.1 below. Any benefits distributed to, or vested in, but not paid or transferred to, or applied for the benefit of, any Beneficiary, in terms of the provisions of this clause and clause 18.9 below, shall not be regarded as a loan, advance or credit provided by a Beneficiary to this Trust. </div>
<div class="clause l1">Any benefits distributed to, or vested in, but not paid or transferred to, or applied for the benefit of, any Beneficiary as envisaged in clause 18.8 above, shall be accumulated and/or invested for such Beneficiary’s sole and exclusive benefit by the Trustees. All retained balances of distributions or vestings, together with any further income that may be derived therefrom, and other accretions thereto (on the basis that any such accumulation of such income, whether invested or not, shall remain the sole property of such Beneficiary) shall, during the continuance of this Trust, be capable of being paid or transferred, provided that any such distribution or vesting, which has accrued to, but not been paid or transferred to, such Beneficiary, including any further income derived therefrom, and other accretions thereto shall -</div>
<div class="clause l2">on the Beneficiary’s death, be paid to the executor of their estate on demand, or upon the Beneficiary’s liquidation, be paid to the liquidator of the entity on demand, as the case may be; and</div>
<div class="clause l2">upon the deregistration of this Trust, in terms of the provisions of clause 25.3 below, be paid or transferred to the Beneficiary concerned.</div>
<div class="clause l1">Without prejudice to the generality of any of the provisions of this Trust Deed, any Income, net Income, profits, capital gains or Trust Property, or any portion thereof, which the Trustees determine to pay to/or on behalf of any Beneficiary, may be paid or transferred to the trustees of any trust, settlement, disposition or other instrument (wherever the same may be executed or administered), Company or Close Corporation, under which such Beneficiary is beneficially interested or which, in the opinion of the Trustees, is for the benefit of such Beneficiary and such payment or transfer shall be deemed to be a payment of Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, to or on behalf of, or for the benefit of, such Beneficiary. For the foregoing purposes the expression “trust” shall include any trust created by any settlement, declaration of trust, will, codicil, or other instrument under the law in force in any part of the world and a Beneficiary shall be deemed to be interested under a trust if any asset or money is transferred, paid, applied or appointed to them for their benefit, either according to the terms of the trust or in consequence of an exercise of any power of discretion thereby conferred upon any Person. A Beneficiary shall be deemed to be “beneficially interested” in a Company or Close Corporation if the share capital, member’s interest, capital gains, income or dividends of the Company or Close Corporation is or may become transferred, paid, applied or appointed to such Beneficiary or for their benefit, either directly or indirectly, and whether by reasons of their shareholding or membership, or in terms of any trust which is the shareholder or entitled to benefits or in consequence of the exercise of any power or discretion conferred upon any Person under any trust, which is a beneficiary or otherwise howsoever of such Company or Close Corporation.</div>
<div class="clause l1">The Trustees shall be empowered, in their sole, absolute, and unfettered discretion, to apply the Income, net Income, profits. and/or capital gains and, if that is not adequate, the Trust Property, or any portion thereof, in defraying any expenses incurred by or for the benefit of a deceased Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below) during their lifetime, and in paying the costs of and incidental to the funeral or cremation of any deceased Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), and other expenses arising from their death, which includes paying any taxes imposed on their death.</div>
<div class="clause l1">Subject to the provisions of clause 25.2 below, if any Beneficiary shall be a Minor, the Trustees shall not be obliged to pay any Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, to which such Beneficiary may be entitled, into the Guardian’s Fund, but the Trustees may either retain such amounts and deal with them as part of the Trust Property during the minority of such Beneficiary, or they shall be entitled to pay over such amounts either to such Minor Beneficiary or to their parents or guardian, as they in their sole, absolute and unfettered discretion think fit, and the receipt by such parents or guardian shall constitute a complete discharge to the Trustees of all their obligations to the Minor Beneficiary regarding the amounts so paid over.</div>
<div class="clause l1">Notwithstanding anything to the contrary contained in this Trust Deed, Income, net Income, profits, capital gains, and/or Trust Property, or any portion thereof, may be applied for the benefit and Welfare of or paid to, or placed to the credit of, a Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), who is not a resident of the Republic of South Africa, and such consent as may be required in terms of the Exchange Control Regulations (if any) will be obtained. Should the participation in allocations, distributions, vestings, payments or application for the benefit and Welfare of a Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), under this Trust, of a Person who is not for the time being a resident of the Republic of South Africa, for the purposes of the Exchange Control Regulations, result in this Trust or any Company or other entity, in which it has any direct or indirect interest, being classified as an “affected person” for the purposes of the Exchange Control Regulations, the Trustees may, by unanimous decision, in terms of the provisions of clause 13.9.14 above, limit the extent of the participation in allocations, distributions, vestings, payments or application for the Welfare of a Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 below), under this Trust, to such Person, so as to avoid such classification, treatment, preclusion or restriction, with the right to reinstate such Person’s participation when the restrictions are no longer necessary or operative.</div>
<div class="clause l1">The Trustees shall not be obliged to advise any Beneficiary or other Person of any obligations or actions required by them pertaining to any income tax or capital gains tax, or any other statutory obligations and compliance, pursuant to any allocation, distribution, vesting, or payment, to them or application for their benefit and Welfare of Income, net Income, profits, capital gains and/or Trust Property,  or any portion thereof, or for allowing them the use of Trust Property in terms of the provisions of clause 12.4.35 above,  in terms of the provisions of this Trust Deed.</div>
<div class="clause l1">In the event of all the Trust Capital having already been used, paid, or applied, the Trustees shall deregister this Trust, in terms of the provisions of clause 25 below, and effect final distributions in terms of the provisions of this clause 18.</div>
<div class="clause l0">PROTECTION OF BENEFICIARIES’ RIGHTS AND INTERESTS</div>
<div class="clause l1">As a result of the fact that this is a discretionary trust and the Trust Property vests in the Trustees in their official capacities, the Beneficiaries have, subject to the provisions of clause 18.9 above and this clause, no vested or claiming rights to the Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, and the Beneficiaries have no right during the subsistence of this Trust, to deal with the Income, net Income, profits, capital gains and/or Trust Property, or distributions, vestings, or allocations (together with accretions thereto and income thereon), or any portion thereof, before it is paid or transferred to the Beneficiaries, by the Trustees, in exercising their sole, absolute and unfettered discretion in favour of such Beneficiaries.</div>
<div class="clause l1">No contingent rights and/or hopes of a Beneficiary under this Trust Deed, and no part thereof, shall be attachable by any creditor of such Beneficiary, or vest in their trustee in insolvency, until such time that an allocation, vesting, or distribution is made by the Trustees in their sole, absolute and unfettered discretion, to such Beneficiary. </div>
<div class="clause l2">If, before any allocation, vesting, or distribution being made to any Beneficiary by the Trustees, such Beneficiary:</div>
<div class="clause l3">attempts to cede, assign, or pledge their contingent rights and hopes without the prior written consent of the Trustees in terms of clause 19.4 below;</div>
<div class="clause l3">commits any act or is subject to any legal proceedings in terms of which their contingent rights and hopes, but for the provisions of this clause, might become vested in or payable to any other Person or Persons or otherwise causes an attachment to be made or execution be levied on or against their contingent rights or hopes; or</div>
<div class="clause l3">is declared insolvent or assigns their estate in favour of their creditors;</div>
<p class="normal continuation">then and in any or all of such cases, the contingent rights and hopes of such Beneficiary shall immediately and entirely thenceforth cease and terminate, and those contingent rights and hopes shall thereupon, and subject to the provisions below, be exercised only in favour of the remaining Beneficiaries, as if the Beneficiary concerned had died at the time of such cessation and termination.</p>
<div class="clause l2">Notwithstanding the provisions of clause 19.2.1 above:</div>
<div class="clause l3">no such Beneficiary shall be obliged to repay to this Trust any amounts previously paid to them by the Trustees;</div>
<div class="clause l3">the Trustees shall be entitled, in their sole, absolute and unfettered discretion, to continue to hold in trust for the lifetime of the Beneficiary concerned (or such lesser period as they may decide) the share or part of the Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, to which they would, without the happening of the events specified in this clause, have become entitled, and to pay, or, without detracting from the other powers conferred on them and subject to such conditions as they may decide in their sole, absolute and unfettered discretion, to impose, advance to, or apply Income, net Income, profits, capital gains and/or Trust Property, or any portion thereof, for the benefit of such Beneficiary, their Spouse, their parents, or their Descendants for their benefit and Welfare, and to allow the occupation or use of Trust Property for a period or periods to such Person or Persons in terms of the provisions of clause 12.4.35 above, as they in their sole, absolute and unfettered discretion shall deem fit;</div>
<div class="clause l3">if the Trustees do continue to hold the said share of the Income, net Income, profits, capital gains, and/or Trust Property, or any portion thereof, in trust as aforesaid, then notwithstanding that the contingent rights and hopes of the Beneficiary shall have ceased, and notwithstanding anything to the contrary herein contained, such accumulated amounts shall, on the Beneficiary’s death, be available to any Descendant of such a Beneficiary, but always subject to the sole, absolute and unfettered discretion of the Trustees to transfer or pay such amounts or assets as and when they deem fit; and</div>
<div class="clause l3">if the occurrence giving rise to the failure of any interest in terms of this clause ends, the interest will again vest in the Beneficiary in question per the provisions of this Trust Deed.</div>
<div class="clause l1">Any amounts that have vested in and accrued to a Beneficiary in terms of the provisions of this Trust Deed and accretions thereto and income thereon are excluded from the operation of clause 19.2 above, but subject to the provisions of clause 19.4 below.</div>
<div class="clause l1">The Trustees shall be entitled to refuse to recognise, and to treat as null and void, any cession, assignment, pledge, disposal, or alienation of any contingent right or hope, or vested right, of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 above) hereunder and their unanimous decision will be required to effect such a cession, assignment, pledge, disposal or alienation of the contingent right or hope, or vested right, of any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 above) in terms of the provisions of clause 13.9.15 above.</div>
<div class="clause l1">The Trustees may refuse to make any payment, or transfer assets, otherwise than directly, to, or on behalf of, or for the benefit of, the Person entitled thereto under this Trust Deed.</div>
<div class="clause l1">Any allocation, vesting, distribution, payment, delivering, or transfer of Income, net Income, profit, capital gain, Trust Property, right, or allowance of occupation, or use for a period or periods to a Beneficiary or other Person (in terms of the provisions of clause 19.2.2.2 above), by the Trustees, exercising their sole, absolute and unfettered discretion in favour of such Beneficiary or Person, does not in any way create any permanent vesting or rights for such a Beneficiary or Person. A Beneficiary only assumes any vesting right each time the Trustees exercise their sole, absolute, and unfettered discretion in favour of such a Beneficiary or Person.</div>
<div class="clause l1">All allocations, vestings, distributions, and payments to a Beneficiary in terms of this Trust Deed shall for all purposes be the sole property of the Beneficiary and excluded from any community of property, or community of profit and loss. Any accrual application, if applicable, shall not apply to allocations, vestings, distributions, and payments derived from this Trust by any Beneficiary.</div>
<div class="clause l0">INDEMNITY AGAINST TAX LIABILITY</div>
<div class="clause l1">Should any Person (each Person being hereinafter called “the taxpayer”), who makes a donation, settlement, or other disposition to this Trust, or the estate of such taxpayer, become liable for any form of taxation imposed by the South African Revenue Service as a result thereof, the Trustees shall be entitled to refund to such a taxpayer or estate, as the case may be, out of the Trust Property, the amount of the tax for which the taxpayer or estate becomes so liable with the intent of affording the taxpayer or estate a full indemnity against the related tax for which the taxpayer or estate becomes liable.</div>
<div class="clause l1">If any Person is assessed by the South African Revenue Service to be liable for any tax as a result of any allocation, vesting, distribution, or payment made by the Trustees to any Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 above) (but such distribution or vesting remains unpaid or was only made in specie), or the application for the benefit and Welfare of a Beneficiary or Person (in terms of the provisions of clause 19.2.2.2 above), or the enjoyment by the Beneficiary or their Spouse, or other Person (in terms of the provisions of clause 19.2.2.2 above) of the Trust Property, in terms of this Trust Deed, then such Person shall be entitled to recover an amount equal to such tax levied by the South African Revenue Service from this Trust. Any amounts so recovered from this Trust shall be deducted from the relevant Beneficiary’s unpaid distributions or vestings, or if insufficient, be debited against their loan account.</div>
<div class="clause l1">The Trustees shall be indemnified from any claims for any taxation, levies, imposts, and duties of whatsoever nature and howsoever arising, save that such indemnity extends only to the Trustees in their capacity as representative taxpayers on behalf of this Trust.</div>
<div class="clause l0">RENUNCIATION BY BENEFICIARY</div>
<div class="clause l1">Any Beneficiary shall be entitled, by written notice to the Trustees to declare that they shall thenceforth cease to be a Beneficiary of this Trust and upon delivery of such notice this Trust Deed shall thenceforth take effect as if that Beneficiary were dead or ceased to exist.</div>
<div class="clause l1">If a Beneficiary repudiates any allocation, vesting, distribution, and/or payment, which would have vested in them or would have accrued to them in terms of this Trust Deed, the Trustees shall have the power, in their sole, absolute and unfettered discretion, to substitute any of their Descendants or another Company, Close Corporation or trust connected to such Descendants, for them, and the Trustees are further empowered to create a further trust or trusts for such substituted Beneficiaries in terms of this Trust Deed.</div>
<div class="clause l0">SEPARATION OF TRUST CAPITAL</div>
<div class="clause l1">At any time during the operation of this Trust, the Trustees, if they, in their sole, absolute, and unfettered discretion deem it advisable, may divide the Trust Capital into separate portions for each Beneficiary and create (through a formal written deed of trust in any country) a separate trust or trusts in respect of each portion of the Trust Property so divided for the general benefit of the Beneficiary for whom the portion is allocated, with similar rights for Beneficiaries as per this Trust Deed.</div>
<div class="clause l1">With the exclusion of the name of this Trust and the parties to and Beneficiaries under this Trust Deed, the contents of the trust deed or trust deeds of such further trust or trusts shall, as far as practically possible, mutatis mutandis, be the same as the provisions of this Trust Deed.</div>
<div class="clause l1">At least one of the Trustees of this Trust then in office shall be appointed as one of the first trustees of such further trust or trusts.</div>
<div class="clause l1">The Trustees of this Trust will be relieved of any further responsibility over any part of the Trust Property, which is transferred to such further trust or trusts that is/are created in terms of the provisions of this clause 22.</div>
<div class="clause l0">ACCOUNTING MATTERS, BANKING AND OTHER ACCOUNTS, BENEFICIAL OWNERSHIP REQUIREMENTS, TRUSTEES’ INTERACTIONS WITH ACCOUNTABLE INSTITUTIONS AND TAX OBLIGATIONS</div>
<div class="clause l1">The Trustees shall keep proper records and books of account of their administration of this Trust in such a manner and form as is necessary so that the records and books shall at all times reflect a fair position of this Trust. Such books, together with all other papers and documents connected with or relating to this Trust, shall be kept at such place as may be agreed upon by the Trustees and same shall at all times be accessible to each of the Trustees. The Trustees may engage such secretarial or accounting assistance as may be required for this Trust.</div>
<div class="clause l1">The Trustees shall immediately upon the coming into operation of this Trust appoint an accountant (at their election), and note such appointment with the Master of the High Court, for such time and subject to such conditions as may be determined by the Trustees, and who/which may from time to time be replaced by the Trustees, it being the intention, however, that there shall be an accountant of this Trust at all times. </div>
<div class="clause l1">Every accountant of this Trust shall have the right of access, at all times, to the books of account, vouchers, and records of this Trust, as well as to such information and explanations from Trustees as may be necessary for the performance of the duties of the accountant.</div>
<div class="clause l1">In the event of an accountant being appointed, they shall prepare, from the accounting records of this Trust and any other information which they may require from the Trustees, a set of financial statements of this Trust in respect of each Financial Year, in a format to transparently report to the various stakeholders in this Trust, including its Beneficiaries, and containing sufficient, appropriate information required for the preparation of trust-specific tax returns. If the Trustees themselves prepare, or cause to be prepared, such financial statements, the accountant or auditor should verify that the financial statements are in accordance with the accounting records of this Trust and meet the above requirements. The Trustees and the accountant shall report on the financial statements.</div>
<div class="clause l1">The Trustees need only to account to any Beneficiary when requested to do so by such a Beneficiary.</div>
<div class="clause l1">All monies received on behalf of this Trust shall, unless the Trustees unanimously decide otherwise, be deposited into one or more banking accounts in this Trust’s name, opened in terms of the Trustees’ powers in terms of the provisions of clause 12.4.1 above, which account/s shall be maintained by the Trustees with such branch or branches of such banks as they in their sole, absolute and unfettered discretion may deem fit. All payments to be made on behalf of this Trust shall, if this Trust has any such account, and as far as practically possible, be made from such account. Deposits and withdrawals from such account may be made as approved in terms of this Trust Deed, in particular in terms of the powers of approval in terms of the provisions of clause 15.4 above, but all operations in this Trust’s banking account/s shall be in accordance with resolutions passed by the Trustees from time to time.</div>
<div class="clause l1">The Trustees shall disclose their positions as Trustees to any Accountable Institution with which they engage in that capacity, and make it known to such Accountable Institution that the relevant transaction or business relationship relates to Trust Property in terms of the provisions of the Trust Property Control Act 57 of 1988, as amended. </div>
<div class="clause l1">The Trustees shall record the prescribed details required in terms of the provisions of the Trust Property Control Act 57 of 1988, as amended, relating to Accountable Institutions which the Trustees use as agents to perform any of the Trustees’ functions relating to Trust Property and from which the Trustees obtain any services in respect of the Trustees’ functions relating to Trust Property.</div>
<div class="clause l1">The Trustees shall—</div>
<div class="clause l2">establish and record the Beneficial Owners of this Trust;</div>
<div class="clause l2">keep a record of the prescribed information relating to the Beneficial Owners of this Trust; </div>
<div class="clause l2">lodge a register of the prescribed information on the Beneficial Owners of this Trust with the Master of the High Court; and</div>
<div class="clause l2">ensure that the prescribed information referred to in sub-clauses 23.9.1 to 23.9.3 above is kept up to date. </div>
<div class="clause l1">The Trustees shall make the information contained in the register referred to in sub-clause 23.9.3 above available to any Person as prescribed in terms of the Trust Property Control Act 57 of 1988, as amended.</div>
<div class="clause l1">The Trustees shall meet their reporting obligations to the South African Revenue Service on an ongoing basis.</div>
<div class="clause l0">AMENDMENT OF TRUST DEED</div>
<div class="clause l1">This Trust Deed may be amended subject to the provisions of clauses 7.3.7, 12.4.39, 13.9.17 and 13.15 above, clause 28.2 below, as well as this clause 24.</div>
<div class="clause l1">The Founder (required only if they are still alive and capable of doing so, in the instance of a natural person, or in the instance of an entity, if it still exists) and the Trustees (approval from the Beneficiaries will specifically not be required) may, at any time, by unanimous decision, amend this Trust Deed, subject to the proviso that the main object of this Trust shall not be amended. </div>
<div class="clause l1">Should an amendment not be approved as required in terms of the provisions of clause  24.2 above, the matter should be referred to mediation in terms of the provisions of clause 14 above, and if no agreement is reached during mediation, an application may be made to the Court in terms of the provisions of Section 13 of the Trust Property Control Act 57 of 1988, as amended, to effect such amendment.</div>
<div class="clause l1">No amendment to this Trust Deed shall be of any force and effect to the extent that any benefit shall be conferred by such amendment on the Founder and/or their estate, nor shall any variation give the Founder, or any Trustee the power to appropriate or dispose of any Trust Property, on their own, as they see fit, for their benefit or the benefit of their estates (directly or indirectly), whether such power is exercisable by them or with their consent, and whether such power could be obtained directly or indirectly by the exercise, with or without notice, of such power exercisable by them or with their consent.</div>
<div class="clause l1">Any amendment shall be effective only once all requirements stipulated in this clause 24 are met, the relevant resolution to amend this Trust Deed, as well as the amended trust deed, have been signed by all relevant parties as envisaged in this clause 24. Any obstructive behaviour to affect a duly approved amendment shall be dealt with in terms of the provisions of clause 14 above.</div>
<div class="clause l1">The Trustees shall lodge this Trust Deed with the Master of the High Court in terms of the provisions of Section 4 of the Trust Property Control Act 58 of 1988, as amended.</div>
<div class="clause l0">DEREGISTRATION OF THIS TRUST </div>
<div class="clause l1"> This Trust shall endure in perpetuity, unless  any statutory prescription as to the period this Trust may continue to endure exists. However, subject to the provisions of clauses 7.3.8, 12.4.40, 13.9.18, 13.15 and 18.15 above, this clause 25, and the requirements set by the Master of the High Court, from time to time, in the event of the objective and purpose of this Trust no longer being capable of being achieved, then the Founder (required only if they are still alive and capable of doing so, in the instance of a natural person, or in the instance of an entity, if it still exists) and the Trustees (approval from the Beneficiaries will specifically not be required) may, by unanimous decision, deregister this Trust. In the event that a decision cannot be reached as envisaged in this clause 25.1, the matter shall be dealt with in terms of the provisions of clause 14 above. </div>
<div class="clause l1">In the event that this Trust is terminated in terms of this clause 25, the Trustees shall allocate and convey the remaining Trust Property (net of this Trust’s debt) to the remaining Beneficiaries (or for their benefit), in accordance with their free will, in their sole, absolute and unfettered discretion and without necessarily maintaining or implementing the principle of parity between the remaining Beneficiaries.  However, any Beneficiary who has not yet reached the age of 25 (twenty-five) years with remaining vested rights in the Income, net Income, profits, capital gains, or Trust Property, or any portion thereof, from previous allocations, vestings, or distributions, or from a distribution or vesting in terms of the provisions of this clause 25.2, will not receive their final distribution or vesting, as their total accumulated distributions or vestings will be retained in this Trust and managed by the Trustees until such Beneficiary has reached the age of 25 (twenty-five) years. All non-natural Person Beneficiaries and natural Person Beneficiaries over the age of 25 (twenty-five) years who have received their final distributions or vestings (or which have been applied for their benefit) as envisaged in this clause 25.2 shall be deemed to have renounced their rights in this Trust in terms of the provisions of clause 21.1 above and have no further claims of any nature against this Trust. As and when any remaining Beneficiary reaches the age of 25 (twenty-five) years, they shall receive all accumulated distributions or vestings and further additions (or it shall be applied for their benefit) in terms of the provisions of clause 18.9 above. This Trust shall finally be deregistered when all Beneficiaries have received their final distributions or vestings (or which have been applied for their benefit) as envisaged in this clause 25.2. </div>
<div class="clause l1">Upon deregistration of this Trust for any reason, any Income, net Income, profits, capital gains, and Trust Property, or any portion thereof, that have vested in and accrued to a Beneficiary, but which have not yet been paid or transferred to (or applied for the benefit and Welfare of) the Beneficiary concerned (including final distributions or vestings to the remaining Beneficiaries in terms of the provisions of clause 25.2 above), together with unpaid income derived therefrom and all accretions thereto, shall be paid or transferred to them, or applied for their benefit, as envisaged in clause 18.9 above.</div>
<div class="clause l0">GOVERNING LAW AND JURISDICTION</div>
<div class="clause l1">This Trust is a tax resident of the Republic of South Africa.</div>
<div class="clause l1">South African Law shall govern this Trust.</div>
<div class="clause l1">The jurisdiction of this Trust for purposes of determining the jurisdiction of the Master of the High Court shall be the Master of the High Court’s Office where this Trust was registered and the Letters of Authority issued, save that the jurisdiction may change as specified in the Trust Property Control Act 57 of 1988, as amended.</div>
<div class="clause l0">NOTICES AND DOMICILIA</div>
<div class="clause l1">The parties choose as their respective domicilia citandi et executandi for the purpose of legal proceedings and for the purposes of giving or sending any notice provided for or necessary in terms hereof, the following addresses:</div>
{{DOMICILIA}}
<div class="clause l1">A party may, subject to the provisions of clause 10.1.9 above, change their domicilium to any other physical address or email address by written notice to the other parties to that effect. Such change of address will be effective 7 (seven) days after receipt of notice of the change of domicilium.</div>
<div class="clause l1">All notices to be given in terms of this Trust Deed will be in writing and:</div>
<div class="clause l2">if delivered by hand during normal business hours, be presumed to have been received on the date of delivery;</div>
<div class="clause l2">if sent by email before 16h30 on a day, which is a business day, be presumed to have been received on the date of successful transmission of the email. Any email sent after 16h30 on a business day, or on a day that is not a business day, will be presumed to have been received on the following business day. </div>
<div class="clause l1">Any notice in terms of this Trust Deed shall only be validly given if in written, email, or printed paper-based form. For the avoidance of doubt, where any provision of this Trust Deed requires a party to perform any act in writing, this requirement will only be satisfied if such performance is made in a written, email, or printed paper-based form. </div>
<div class="clause l1">Notwithstanding the above, any notice actually received by a party to whom such notice is addressed will be deemed to have been properly given and received, notwithstanding that such notice has not been given per the provisions of this clause 27.</div>
<div class="clause l0">SEVERABILITY</div>
<div class="clause l1">In the event of any term or condition of this Trust Deed being or becoming invalid or unenforceable for whatsoever reason, then and in such event, the offending term and condition shall be severed from this Trust Deed and the remaining terms and conditions shall remain in full force and effect.</div>
<div class="clause l1">Notwithstanding anything to the contrary contained in this Trust Deed, if in the opinion of the Trustees, any provision of this Trust Deed would or might invalidate a disposition made in favour of this Trust in the will of a Person who has died, the Trustees shall, if they do not elect to repudiate the disposition or to accept the invalidity thereof, be entitled to cancel each offending provision only or amend it to such extent as is necessary to avoid the invalidity and to effect such consequential amendments to this Trust Deed, subject to and in terms of the provisions of clause 24 above, as they in their sole, absolute and unfettered discretion consider necessary. This will only be allowed if the rights of the Beneficiaries are not affected in any negative way.</div>
<div class="clause l0">SIGNATURE</div>
<div class="clause l1">This Trust Deed is signed by the Founder and First Trustees on the date/s and at the place/s indicated below.</div>
<div class="clause l1">This Trust Deed may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute the same contract as at the date of signature of the party last signing one of the counterparts.</div>
<div class="clause l1">The parties signing this Trust Deed in a representative capacity warrant their authority to do so.</div>
<div class="clause l1">The parties record that it is not required for this Trust Deed to be valid and enforceable that the parties shall have their signatures of this Trust Deed verified by a witness.</div>
{{SIGNED_DATE_LINE}}
{{SIGNATURE_BLOCK}}`;

export function deedValidation(trust: TrustRecord, parties: TrustParty[]) {
  const issues: string[] = [];
  const founders = parties.filter((party) => party.role_founder);
  const trustees = parties.filter((party) => party.role_trustee || party.role_independent_trustee);
  const independent = parties.filter((party) => party.role_independent_trustee);
  const beneficiaries = parties.filter((party) => party.role_beneficiary);

  if (!trust.name?.trim()) issues.push("Trust name is missing.");
  if (!trust.masters_office?.trim()) issues.push("Master's office is missing.");
  if (!founders.length) issues.push("Founder is missing.");
  if (founders.length > 1) issues.push("More than one Founder is captured; review the deed before issue.");
  if (trustees.length < 2) issues.push("At least two trustees must be captured for this deed structure.");
  if (!independent.length) issues.push("Independent Trustee is missing.");
  if (!beneficiaries.length) issues.push("No beneficiaries are captured.");
  beneficiaries.forEach((beneficiary) => {
    if (!beneficiary.is_income_beneficiary && !beneficiary.is_capital_beneficiary) {
      issues.push(`${beneficiary.full_name}: choose Income and/or Capital beneficiary.`);
    }
    if (beneficiary.is_income_beneficiary && beneficiary.income_right_type === "vested") {
      issues.push(`${beneficiary.full_name}: vested income rights require alternate deed wording; the standard PP deed is discretionary.`);
    }
    if (beneficiary.is_capital_beneficiary && beneficiary.capital_right_type === "vested") {
      issues.push(`${beneficiary.full_name}: vested capital rights require alternate deed wording; the standard PP deed is discretionary.`);
    }
  });
  const trusteeCount = trustees.length;
  const docSigners = Number(trust.document_signatory_count || 1);
  const bankSigners = Number(trust.bank_signatory_count || 1);
  if (docSigners > trusteeCount) issues.push("Document signatory count exceeds the number of trustees.");
  if (bankSigners > trusteeCount) issues.push("Bank signatory count exceeds the number of trustees.");
  if (!trust.deed_settings_confirmed) issues.push("Deed Settings have not yet been reviewed and confirmed.");
  return issues;
}

export function buildDeedHtml(trust: TrustRecord, parties: TrustParty[]) {
  const founders = parties.filter((party) => party.role_founder);
  const founder = founders[0];
  const nonIndependentTrustees = parties.filter(
    (party) => party.role_trustee && !party.role_independent_trustee
  );
  const independentTrustees = parties.filter((party) => party.role_independent_trustee);
  const firstTrustees = [...nonIndependentTrustees, ...independentTrustees];
  const capital = parties.filter(
    (party) => party.role_beneficiary && party.is_capital_beneficiary
  );
  const income = parties.filter(
    (party) => party.role_beneficiary && party.is_income_beneficiary
  );
  const donation = Number(trust.initial_donation || 100);
  const year = new Date().getFullYear();

  let body = MASTER_DEED_BODY;
  body = body.replace("{{PARTY_BLOCK}}", partyBlock(founder, firstTrustees));
  body = body.replace("{{CAPITAL_BENEFICIARIES}}", beneficiaryBlock(capital));
  body = body.replace("{{CAPITAL_FALLBACK}}", fallbackClause(capital));
  body = body.replace("{{INCOME_BENEFICIARIES}}", beneficiaryBlock(income, capital));
  body = body.replace("{{INCOME_FALLBACK}}", fallbackClause(income));
  body = body.replace("{{INDEPENDENT_TRUSTEE_DEFINITION}}", independentDefinition(independentTrustees[0]));
  body = body.replace(
    "{{TRUST_NAME_CLAUSE}}",
    `<div class="clause l1">The name of this Trust is <strong>${e(trust.name.toUpperCase())}</strong>.</div>`
  );
  body = body.replace(
    "{{DONATION_CLAUSE}}",
    `<div class="clause l1">The Founder hereby irrevocably settles on the First Trustees as the initial founding subject matter, the amount to the value of <strong>R${donation.toFixed(
      2
    )}</strong>, to be held by them for the benefit and Welfare of the Beneficiaries or Persons (in terms of the provisions of clause 19.2.2.2 below), upon the terms set out in this Trust Deed, which settlement the Trustees hereby expressly acknowledge and accept.</div>`
  );
  body = body.replace("{{SIGNING_POWERS_CLAUSE}}", signingClause(trust, firstTrustees));
  body = body.replace("{{BANK_APPROVAL_CLAUSE}}", bankApprovalClause(trust, firstTrustees));
  body = body.replace("{{DOMICILIA}}", domiciliaBlock(founder, firstTrustees));
  body = body.replace(
    "{{SIGNED_DATE_LINE}}",
    `<p class="signed-date">SIGNED at ____________________________ on this the ___ day of _____________________ ${year}.</p>`
  );
  body = body.replace("{{SIGNATURE_BLOCK}}", signatureBlock(founder, firstTrustees));

  body = body.replaceAll("{{", "").replaceAll("}}", "");

  const issues = deedValidation(trust, parties);
  const warning = issues.length
    ? `<div class="validation-warning"><strong>PP validation:</strong><ul>${issues
        .map((issue) => `<li>${e(issue)}</li>`)
        .join("")}</ul></div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${e(trust.name)} - Trust Deed</title>
<style>
@page { size: A4; margin: 18mm 18mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin:0; color:#111; font-family: Georgia, "Times New Roman", serif; font-size:10.5pt; line-height:1.48; counter-reset:l0; }
.cover { min-height:255mm; display:grid; place-content:center; text-align:center; page-break-after:always; }
.cover .small { font-size:17pt; font-weight:700; }
.cover .name { margin-top:28px; font-size:22pt; font-weight:800; }
.deed-title { text-align:center; font-size:16pt; font-weight:800; margin:0 0 22px; }
.entered-between { text-align:center; margin:0 0 26px; }
.party { margin:15px 0; }
.party-capacity { font-weight:700; font-style:italic; }
.first-trustees { text-align:right; margin:12px 0 28px; }
.and { margin:12px 0; font-weight:700; }
.clause { margin:7px 0; text-align:justify; }
.l0 { counter-increment:l0; counter-reset:l1 l2 l3; margin-top:20px; font-weight:800; font-size:11pt; text-align:left; page-break-after:avoid; }
.l0::before { content: counter(l0) "  "; }
.l1 { counter-increment:l1; counter-reset:l2 l3; padding-left:13mm; text-indent:-13mm; }
.l1::before { content: counter(l0) "." counter(l1) "  "; font-weight:400; }
.l2 { counter-increment:l2; counter-reset:l3; padding-left:20mm; text-indent:-20mm; }
.l2::before { content: counter(l0) "." counter(l1) "." counter(l2) "  "; font-weight:400; }
.l3 { counter-increment:l3; padding-left:27mm; text-indent:-27mm; }
.l3::before { content: counter(l0) "." counter(l1) "." counter(l2) "." counter(l3) "  "; font-weight:400; }
.normal { margin:7px 0; text-align:justify; }
.domicilia { width:100%; border-collapse:collapse; margin:10px 0 18px; }
.domicilia td { padding:3px 6px; vertical-align:top; }
.domicilia td:first-child { width:28%; font-weight:600; }
.signature { margin-top:42px; page-break-inside:avoid; }
.signature-line { width:92mm; border-bottom:1px solid #111; margin-bottom:7px; }
.signature strong,.signature span { display:block; }
.signed-date { margin-top:28px; margin-bottom:44px; line-height:1.9; }
.validation-warning { border:1px solid #b45309; background:#fffbeb; color:#78350f; padding:10px 12px; margin-bottom:18px; font-family:Arial,sans-serif; font-size:9pt; }
.validation-warning ul { margin:5px 0 0 18px; padding:0; }
.missing { color:#9c3527; }
@media print { .validation-warning { display:none; } }
</style>
</head>
<body>
<div class="cover"><div><div class="small">DISCRETIONARY TRUST DEED</div><div class="small" style="margin-top:20px">OF</div><div class="name">${e(
    trust.name.toUpperCase()
  )}</div></div></div>
${warning}
${body}
</body>
</html>`;
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
