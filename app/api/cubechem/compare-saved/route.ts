import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCubeChemAccess,
  getRequestEmail,
} from "../lib/checkCubeChemAccess";

type SupplierItem = {
  item_code: string;
  description: string;
  supplier_ex_vat: number;
};

type FromPrice = {
  ccd_item_code: string;
  description: string;
  approved_price: number;
};

type ProductRule = {
  ccd_item_code: string;
  ccd_description: string | null;
  rule_type: string;
  source_items: any[];
  bottle_cost: number;
};

type CategoryRule = {
  category_name: string;
  category_sort: number;
  item_sort: number | null;
  item_code_prefix: string | null;
  item_code_exact: string | null;
  description_contains: string | null;
};

type SizeInfo = {
  unit: "ml" | "kg" | null;
  totalSize: number | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function toMonthDate(value: string) {
  return `${value}-01`;
}

function roundWholeRand(value: number) {
  return Math.round(value);
}

function cleanDescription(value: string) {
  return String(value || "")
    .replace(
      /\s*\|\s*R[\d,]+(\.\d{2})?\s*-\s*SAVING\s*-\s*R\s*[\d,]+(\.\d{2})?/gi,
      ""
    )
    .replace(/\s*\*{2,3}\s*SAVE\s*R\s*[0-9,]+(\.[0-9]{2})?/gi, "")
    .trim();
}

function calculatePricesFromCost(
  cost: number,
  hqMarkupPercent = 15,
  branchMarkupPercent = 45
) {
  const hqExVat = cost * (1 + hqMarkupPercent / 100);
  const hqIncVat = hqExVat * 1.15;
  const branchPrice = roundWholeRand(hqIncVat * (1 + branchMarkupPercent / 100));

  return {
    hqPrice: roundWholeRand(hqIncVat),
    branchPrice,
  };
}

function parseSize(description: string): SizeInfo {
  const text = String(description || "").toLowerCase();

  const packMatch = text.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|l|kg|g)/i);

  if (packMatch) {
    const quantity = Number(packMatch[1]);
    const size = Number(packMatch[2]);
    const unit = packMatch[3].toLowerCase();

    if (unit === "ml") return { unit: "ml", totalSize: quantity * size };
    if (unit === "l") return { unit: "ml", totalSize: quantity * size * 1000 };
    if (unit === "kg") return { unit: "kg", totalSize: quantity * size };
    if (unit === "g") return { unit: "kg", totalSize: (quantity * size) / 1000 };
  }

  const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*(ml|l|kg|g)/i);

  if (singleMatch) {
    const size = Number(singleMatch[1]);
    const unit = singleMatch[2].toLowerCase();

    if (unit === "ml") return { unit: "ml", totalSize: size };
    if (unit === "l") return { unit: "ml", totalSize: size * 1000 };
    if (unit === "kg") return { unit: "kg", totalSize: size };
    if (unit === "g") return { unit: "kg", totalSize: size / 1000 };
  }

  return { unit: null, totalSize: null };
}

function calculateDirectCost(ccdDescription: string, supplier: SupplierItem) {
  const supplierSize = parseSize(supplier.description);
  const ccdSize = parseSize(ccdDescription);

  const supplierCost = Number(supplier.supplier_ex_vat || 0);

  if (
    supplierSize.unit &&
    ccdSize.unit &&
    supplierSize.unit === ccdSize.unit &&
    supplierSize.totalSize &&
    ccdSize.totalSize &&
    supplierSize.totalSize > 0
  ) {
    return supplierCost * (ccdSize.totalSize / supplierSize.totalSize);
  }

  return supplierCost;
}

function calculateComponentCost(
  component: any,
  supplierMap: Map<string, SupplierItem>
) {
  const sourceCode = String(component.source_code || "").toUpperCase();
  const supplier = supplierMap.get(sourceCode);

  if (!supplier) {
    return {
      cost: 0,
      missing: sourceCode,
    };
  }

  const supplierCost = Number(supplier.supplier_ex_vat || 0);
  let componentCost = supplierCost;

  if (component.source_size_ml && component.target_size_ml) {
    componentCost =
      supplierCost *
      (Number(component.target_size_ml) / Number(component.source_size_ml));
  }

  if (component.source_size_kg && component.target_size_kg) {
    componentCost =
      supplierCost *
      (Number(component.target_size_kg) / Number(component.source_size_kg));
  }

  if (component.quantity) {
    componentCost = supplierCost * Number(component.quantity);
  }

  if (component.bottle_cost) {
    componentCost += Number(component.bottle_cost);
  }

  return {
    cost: componentCost,
    missing: null,
  };
}

function calculateRulePrice(
  rule: ProductRule,
  supplierMap: Map<string, SupplierItem>,
  hqMarkupPercent = 15,
  branchMarkupPercent = 45
) {
  let totalCost = 0;
  const missingSources: string[] = [];

  for (const component of rule.source_items || []) {
    const result = calculateComponentCost(component, supplierMap);

    totalCost += result.cost;

    if (result.missing) {
      missingSources.push(result.missing);
    }
  }

  totalCost += Number(rule.bottle_cost || 0);

  if (missingSources.length > 0 || totalCost <= 0) {
    return {
      supplierCost: null,
      hqPrice: null,
      branchPrice: null,
      missingSources,
    };
  }

  const prices = calculatePricesFromCost(
    totalCost,
    hqMarkupPercent,
    branchMarkupPercent
  );

  return {
    supplierCost: totalCost,
    hqPrice: prices.hqPrice,
    branchPrice: prices.branchPrice,
    missingSources,
  };
}

function getCategory(row: any, rules: CategoryRule[]) {
  const itemCode = String(row.item_code || row.ccd_item_code || "").toUpperCase();
  const description = String(row.description || "").toLowerCase();

  const exactRule = rules.find(
    (rule) =>
      rule.item_code_exact &&
      itemCode === String(rule.item_code_exact).toUpperCase()
  );

  if (exactRule) return exactRule;

  const descriptionRule = rules.find(
    (rule) =>
      rule.description_contains &&
      description.includes(String(rule.description_contains).toLowerCase())
  );

  if (descriptionRule) return descriptionRule;

  const prefixRule = rules.find(
    (rule) =>
      rule.item_code_prefix &&
      itemCode.startsWith(String(rule.item_code_prefix).toUpperCase())
  );

  if (prefixRule) return prefixRule;

  return {
    category_name: "Other",
    category_sort: 999,
    item_sort: 9999,
    item_code_prefix: null,
    item_code_exact: null,
    description_contains: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const requestEmail = getRequestEmail(req);
    const access = await checkCubeChemAccess(requestEmail);

    if (!access.allowed) {
      return NextResponse.json(
        { error: "You do not have access to CubeChem." },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    const body = await req.json();

    const compareFromMonth = String(body.compareFromMonth || "");
    const compareToMonth = String(body.compareToMonth || body.priceMonth || "");

    if (!compareFromMonth || !compareToMonth) {
      return NextResponse.json(
        { error: "Compare from month and compare to month are required." },
        { status: 400 }
      );
    }

    const fromMonthDate = toMonthDate(compareFromMonth);
    const toMonthDateValue = toMonthDate(compareToMonth);

    const supplierUpload = await supabase
      .from("cubechem_price_uploads")
      .select("id, price_month, file_name")
      .eq("price_month", toMonthDateValue)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (supplierUpload.error) {
      return NextResponse.json(
        { error: "No Abyx supplier upload found for the compare-to month." },
        { status: 400 }
      );
    }

    const supplierItems = await supabase
      .from("cubechem_price_items")
      .select("*")
      .eq("upload_id", supplierUpload.data.id);

    if (supplierItems.error) throw supplierItems.error;

    const fromReviewPrices = await supabase
      .from("cubechem_price_review_items")
      .select("ccd_item_code, description, approved_price")
      .eq("price_month", fromMonthDate)
      .not("approved_price", "is", null);

    if (fromReviewPrices.error) throw fromReviewPrices.error;

    let fromPrices: FromPrice[] = (fromReviewPrices.data || []).map((row: any) => ({
      ccd_item_code: row.ccd_item_code,
      description: cleanDescription(row.description),
      approved_price: Number(row.approved_price || 0),
    }));

    if (fromPrices.length === 0) {
      const fromApprovedPrices = await supabase
        .from("cubechem_approved_prices")
        .select("ccd_item_code, description, approved_price")
        .eq("price_month", fromMonthDate);

      if (fromApprovedPrices.error) throw fromApprovedPrices.error;

      fromPrices = (fromApprovedPrices.data || []).map((row: any) => ({
        ccd_item_code: row.ccd_item_code,
        description: cleanDescription(row.description),
        approved_price: Number(row.approved_price || 0),
      }));
    }

    if (fromPrices.length === 0) {
      return NextResponse.json(
        { error: `No saved prices found for compare-from month ${fromMonthDate}.` },
        { status: 400 }
      );
    }

    const productRules = await supabase
      .from("cubechem_product_rules")
      .select("*")
      .eq("is_active", true);

    if (productRules.error) throw productRules.error;

    const categoryRules = await supabase
      .from("cubechem_category_rules")
      .select("*")
      .eq("is_active", true)
      .order("category_sort", { ascending: true })
      .order("item_sort", { ascending: true });

    if (categoryRules.error) throw categoryRules.error;

    const rules = (categoryRules.data || []) as CategoryRule[];

    const existingToReview = await supabase
      .from("cubechem_price_review_items")
      .select(
        "ccd_item_code, approved_price, manually_adjusted, accepted_increase, hq_markup_percent, branch_markup_percent"
      )
      .eq("price_month", toMonthDateValue);

    if (existingToReview.error) throw existingToReview.error;

    const existingMap = new Map<string, any>();

    for (const row of existingToReview.data || []) {
      existingMap.set(String(row.ccd_item_code).toUpperCase(), row);
    }

    const supplierMap = new Map<string, SupplierItem>();

    for (const item of supplierItems.data || []) {
      supplierMap.set(String(item.item_code).toUpperCase(), {
        item_code: String(item.item_code).toUpperCase(),
        description: item.description,
        supplier_ex_vat: Number(item.supplier_ex_vat || 0),
      });
    }

    const ruleMap = new Map<string, ProductRule>();

    for (const rule of productRules.data || []) {
      ruleMap.set(String(rule.ccd_item_code).toUpperCase(), {
        ccd_item_code: String(rule.ccd_item_code).toUpperCase(),
        ccd_description: rule.ccd_description,
        rule_type: rule.rule_type,
        source_items: Array.isArray(rule.source_items) ? rule.source_items : [],
        bottle_cost: Number(rule.bottle_cost || 0),
      });
    }

    const comparisonRaw = fromPrices.map((previous: FromPrice) => {
      const ccdCode = String(previous.ccd_item_code).toUpperCase();
      const fromPrice = Number(previous.approved_price || 0);
      const existing = existingMap.get(ccdCode);

      const hqMarkupPercent =
        existing?.hq_markup_percent !== null &&
        existing?.hq_markup_percent !== undefined
          ? Number(existing.hq_markup_percent)
          : 15;

      const branchMarkupPercent =
        existing?.branch_markup_percent !== null &&
        existing?.branch_markup_percent !== undefined
          ? Number(existing.branch_markup_percent)
          : 45;

      const rule = ruleMap.get(ccdCode);
      let baseRow: any;

      if (rule) {
        const rulePrice = calculateRulePrice(
          rule,
          supplierMap,
          hqMarkupPercent,
          branchMarkupPercent
        );

        if (rulePrice.branchPrice === null) {
          baseRow = {
            sheet_name: "All Branches",
            item_code: previous.ccd_item_code,
            description: previous.description,
            old_price: fromPrice,
            supplier_ex_vat: null,
            hq_price: null,
            new_price: null,
            difference: null,
            difference_percent: null,
            status: "RULE SOURCE MISSING",
            pricing_method: rule.rule_type,
            missing_sources: rulePrice.missingSources,
          };
        } else {
          const difference = rulePrice.branchPrice - fromPrice;
          const differencePercent =
            fromPrice > 0 ? (difference / fromPrice) * 100 : 0;

          baseRow = {
            sheet_name: "All Branches",
            item_code: previous.ccd_item_code,
            description: previous.description,
            old_price: fromPrice,
            supplier_ex_vat: rulePrice.supplierCost,
            hq_price: rulePrice.hqPrice,
            new_price: rulePrice.branchPrice,
            difference,
            difference_percent: differencePercent,
            status:
              difference > 0
                ? "INCREASE"
                : difference < 0
                ? "DECREASE"
                : "NO CHANGE",
            pricing_method: rule.rule_type,
            missing_sources: [],
          };
        }
      } else {
        const supplier = supplierMap.get(ccdCode);

        if (!supplier) {
          baseRow = {
            sheet_name: "All Branches",
            item_code: previous.ccd_item_code,
            description: previous.description,
            old_price: fromPrice,
            supplier_ex_vat: null,
            hq_price: null,
            new_price: null,
            difference: null,
            difference_percent: null,
            status: "NOT FOUND",
            pricing_method: "direct",
            missing_sources: [],
          };
        } else {
          const directCost = calculateDirectCost(previous.description, supplier);
          const prices = calculatePricesFromCost(
            directCost,
            hqMarkupPercent,
            branchMarkupPercent
          );

          const newPrice = prices.branchPrice;
          const difference = newPrice - fromPrice;
          const differencePercent =
            fromPrice > 0 ? (difference / fromPrice) * 100 : 0;

          baseRow = {
            sheet_name: "All Branches",
            item_code: previous.ccd_item_code,
            description: previous.description,
            supplier_description: supplier.description,
            old_price: fromPrice,
            supplier_ex_vat: directCost,
            hq_price: prices.hqPrice,
            new_price: newPrice,
            difference,
            difference_percent: differencePercent,
            status:
              difference > 0
                ? "INCREASE"
                : difference < 0
                ? "DECREASE"
                : "NO CHANGE",
            pricing_method: "direct-pack-size",
            missing_sources: [],
          };
        }
      }

      const category = getCategory(baseRow, rules);

      return {
        ...baseRow,
        category_name: category.category_name,
        category_sort: category.category_sort,
        item_sort: category.item_sort ?? 9999,
        hq_markup_percent: hqMarkupPercent,
        branch_markup_percent: branchMarkupPercent,
        accepted_increase: existing?.accepted_increase || false,
        manually_adjusted: existing?.manually_adjusted || false,
      };
    });

    const comparison = comparisonRaw.sort((a: any, b: any) => {
      if (a.category_sort !== b.category_sort) {
        return a.category_sort - b.category_sort;
      }

      if ((a.item_sort ?? 9999) !== (b.item_sort ?? 9999)) {
        return (a.item_sort ?? 9999) - (b.item_sort ?? 9999);
      }

      return String(a.item_code).localeCompare(String(b.item_code));
    });

    const reviewRows = comparison.map((row: any) => {
      const existing = existingMap.get(String(row.item_code).toUpperCase());

      const preserveManual =
        existing &&
        existing.manually_adjusted === true &&
        existing.approved_price !== null &&
        existing.approved_price !== undefined;

      return {
        price_month: toMonthDateValue,
        ccd_item_code: row.item_code,
        description: cleanDescription(row.description),
        previous_approved_price: row.old_price,
        supplier_ex_vat: row.supplier_ex_vat,
        hq_price: row.hq_price,
        calculated_price: row.new_price,
        approved_price: preserveManual ? existing.approved_price : row.new_price,
        difference: row.difference,
        difference_percent: row.difference_percent,
        status: row.status,
        pricing_method: row.pricing_method,
        missing_sources: row.missing_sources || [],
        category_name: row.category_name,
        category_sort: row.category_sort,
        item_sort: row.item_sort,
        accepted_increase: preserveManual ? false : existing?.accepted_increase || false,
        manually_adjusted: preserveManual ? true : existing?.manually_adjusted || false,
        hq_markup_percent: row.hq_markup_percent,
        branch_markup_percent: row.branch_markup_percent,
        updated_at: new Date().toISOString(),
      };
    });

    const saveReview = await supabase
      .from("cubechem_price_review_items")
      .upsert(reviewRows, {
        onConflict: "price_month,ccd_item_code",
      });

    if (saveReview.error) throw saveReview.error;

    return NextResponse.json({
      supplierUpload: supplierUpload.data,
      compareFromMonth: fromMonthDate,
      compareToMonth: toMonthDateValue,
      supplierCount: supplierItems.data?.length || 0,
      fromApprovedCount: fromPrices.length,
      ccdCount: comparison.length,
      comparison,
    });
  } catch (error) {
    console.error("CubeChem saved comparison error:", error);

    const message =
      error instanceof Error ? error.message : "Could not compare saved lists.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}