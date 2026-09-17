"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type ViewKey = "overview" | "members" | "work";

type GroupRow = {
  id: string;
  organisation_id: string;
  group_name: string;
  group_code: string | null;
  notes: string | null;
  is_active: boolean;
};

type MemberRow = {
  id: string;
  group_id: string;
  client_id: string;
  relationship_label: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
};

type ClientRow = {
  id: string;
  client_name: string;
  registration_number: string | null;
  id_passport_number: string | null;
  client_category: string | null;
  relationship_status: string | null;
  entity_type: string | null;
  client_code: string | null;
};

type WorkRow = {
  id: string;
  client_id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  service_code: string | null;
};

function normaliseStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isClosedStatus(value: string | null | undefined) {
  return ["completed", "complete", "done", "cancelled", "closed"].includes(
    normaliseStatus(value)
  );
}

function relationshipLabel(value: string | null | undefined) {
  switch (value) {
    case "flying_client":
      return "Flying Client";
    case "in_airspace":
      return "In Airspace";
    case "on_radar":
      return "On Radar";
    case "former_client":
      return "Former Client";
    default:
      return value || "—";
  }
}

function categoryLabel(value: string | null | undefined) {
  switch (value) {
    case "individual":
      return "Individual";
    case "entity":
      return "Entity";
    case "trust":
      return "Trust";
    default:
      return value || "—";
  }
}

type ServiceBucket =
  | "cipc"
  | "bo"
  | "afs"
  | "tax"
  | "vat"
  | "payroll";

const SERVICE_COLUMNS: Array<{ key: ServiceBucket; label: string }> = [
  { key: "cipc", label: "CIPC AR" },
  { key: "bo", label: "BO" },
  { key: "afs", label: "AFS" },
  { key: "tax", label: "Income Tax" },
  { key: "vat", label: "VAT" },
  { key: "payroll", label: "Payroll / PAYE" },
];

function classifyService(item: WorkRow): ServiceBucket | null {
  const text = `${item.service_code || ""} ${item.title || ""}`.toLowerCase();

  if (
    text.includes("annual return") ||
    text.includes("cipc annual") ||
    text.includes("cipc ar")
  ) {
    return "cipc";
  }

  if (
    text.includes("beneficial ownership") ||
    text.includes("beneficial owner")
  ) {
    return "bo";
  }

  if (
    text.includes("annual financial statement") ||
    text.includes("financial statement") ||
    text.includes("afs")
  ) {
    return "afs";
  }

  if (
    text.includes("income tax") ||
    text.includes("itr12") ||
    text.includes("itr14") ||
    text.includes("tax return")
  ) {
    return "tax";
  }

  if (text.includes("vat")) {
    return "vat";
  }

  if (
    text.includes("payroll") ||
    text.includes("paye") ||
    text.includes("emp201") ||
    text.includes("emp501")
  ) {
    return "payroll";
  }

  return null;
}

function workHealth(
  items: WorkRow[],
  today: Date,
  next30: Date
): "overdue" | "due_soon" | "open" | "clear" | "none" {
  if (!items.length) return "none";

  const openItems = items.filter((item) => !isClosedStatus(item.status));

  if (!openItems.length) return "clear";

  if (
    openItems.some(
      (item) =>
        item.due_date &&
        new Date(`${item.due_date}T00:00:00`) < today
    )
  ) {
    return "overdue";
  }

  if (
    openItems.some(
      (item) =>
        item.due_date &&
        new Date(`${item.due_date}T00:00:00`) <= next30
    )
  ) {
    return "due_soon";
  }

  return "open";
}

function healthLabel(value: ReturnType<typeof workHealth>) {
  switch (value) {
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "open":
      return "Open";
    case "clear":
      return "Clear";
    default:
      return "—";
  }
}

export default function ClientGroupViewPage() {
  const params = useParams();
  const groupId = String(params?.id || "");

  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [memberOptions, setMemberOptions] = useState<ClientRow[]>([]);
  const [workItems, setWorkItems] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupNotes, setGroupNotes] = useState("");

  const [newMemberClientId, setNewMemberClientId] = useState("");
  const [newMemberRelationship, setNewMemberRelationship] = useState("");
  const [newMemberPrimary, setNewMemberPrimary] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    loadGroup();
  }, [groupId]);

  async function getToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    return session.access_token;
  }

  async function apiFetch(init?: RequestInit) {
    const token = await getToken();

    return fetch(`/api/crm/groups?groupId=${encodeURIComponent(groupId)}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  }

  async function loadGroup() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await apiFetch();
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not load client group.");
      }

      const loadedGroup = (result.group || null) as GroupRow | null;

      setGroup(loadedGroup);
      setMembers((result.members || []) as MemberRow[]);
      setClients((result.clients || []) as ClientRow[]);
      setMemberOptions((result.memberOptions || []) as ClientRow[]);
      setWorkItems((result.workItems || []) as WorkRow[]);

      setGroupName(loadedGroup?.group_name || "");
      setGroupCode(loadedGroup?.group_code || "");
      setGroupNotes(loadedGroup?.notes || "");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load client group."
      );
    } finally {
      setLoading(false);
    }
  }

  async function post(payload: Record<string, unknown>) {
    setSaving(true);
    setLoadError("");

    try {
      const token = await getToken();

      const response = await fetch("/api/crm/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Client group could not be updated.");
      }

      await loadGroup();
      return true;
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Client group could not be updated."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const memberClientIds = useMemo(
    () => new Set(members.map((member) => member.client_id)),
    [members]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next30 = new Date(today);
  next30.setDate(next30.getDate() + 30);

  const memberStats = useMemo(() => {
    const stats = new Map<string, { open: number; overdue: number; due30: number }>();

    for (const member of members) {
      stats.set(member.client_id, { open: 0, overdue: 0, due30: 0 });
    }

    for (const item of workItems) {
      const stat = stats.get(item.client_id);
      if (!stat || isClosedStatus(item.status)) continue;

      stat.open += 1;

      if (item.due_date) {
        const due = new Date(`${item.due_date}T00:00:00`);

        if (due < today) stat.overdue += 1;
        else if (due <= next30) stat.due30 += 1;
      }
    }

    return stats;
  }, [members, workItems]);

  const summary = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let due30 = 0;

    for (const stat of memberStats.values()) {
      open += stat.open;
      overdue += stat.overdue;
      due30 += stat.due30;
    }

    return {
      members: members.length,
      flying: clients.filter(
        (client) => client.relationship_status === "flying_client"
      ).length,
      open,
      overdue,
      due30,
    };
  }, [members.length, clients, memberStats]);

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (Boolean(a.is_primary) !== Boolean(b.is_primary)) {
        return a.is_primary ? -1 : 1;
      }

      return String(clientMap.get(a.client_id)?.client_name || "").localeCompare(
        String(clientMap.get(b.client_id)?.client_name || "")
      );
    });
  }, [members, clientMap]);

  const openWork = useMemo(() => {
    return workItems
      .filter((item) => !isClosedStatus(item.status))
      .sort((a, b) => {
        const aDue = a.due_date
          ? new Date(`${a.due_date}T00:00:00`).getTime()
          : Infinity;
        const bDue = b.due_date
          ? new Date(`${b.due_date}T00:00:00`).getTime()
          : Infinity;

        return aDue - bDue;
      });
  }, [workItems]);

  const availableClients = useMemo(
    () =>
      memberOptions.filter((client) => !memberClientIds.has(client.id)),
    [memberOptions, memberClientIds]
  );

  const primaryMember = useMemo(
    () => members.find((member) => Boolean(member.is_primary)) || null,
    [members]
  );

  const attentionItems = useMemo(() => {
    const items: Array<{
      level: "high" | "medium" | "info";
      title: string;
      detail: string;
      clientId?: string;
    }> = [];

    if (!primaryMember && members.length > 0) {
      items.push({
        level: "medium",
        title: "No primary group anchor",
        detail: "Choose the main person or entity for this group.",
      });
    }

    for (const member of orderedMembers) {
      const client = clientMap.get(member.client_id);
      if (!client) continue;

      const stats = memberStats.get(member.client_id) || {
        open: 0,
        overdue: 0,
        due30: 0,
      };

      if (stats.overdue > 0) {
        items.push({
          level: "high",
          title: `${client.client_name}: ${stats.overdue} overdue item${
            stats.overdue === 1 ? "" : "s"
          }`,
          detail: "Immediate attention required.",
          clientId: client.id,
        });
      } else if (stats.due30 > 0) {
        items.push({
          level: "medium",
          title: `${client.client_name}: ${stats.due30} item${
            stats.due30 === 1 ? "" : "s"
          } due in the next 30 days`,
          detail: "Upcoming work should be planned.",
          clientId: client.id,
        });
      }

      if (!member.relationship_label) {
        items.push({
          level: "info",
          title: `${client.client_name}: group relationship not labelled`,
          detail: "Add a relationship label so the group structure is clear.",
          clientId: client.id,
        });
      }

      if (client.relationship_status === "former_client") {
        items.push({
          level: "info",
          title: `${client.client_name}: Former Client`,
          detail: "This record remains linked to the group for history.",
          clientId: client.id,
        });
      }
    }

    return items.slice(0, 10);
  }, [members.length, orderedMembers, clientMap, memberStats, primaryMember]);

  const complianceRows = useMemo(() => {
    return orderedMembers.map((member) => {
      const client = clientMap.get(member.client_id)!;
      const clientWork = workItems.filter(
        (item) => item.client_id === member.client_id
      );

      const services = SERVICE_COLUMNS.reduce(
        (acc, column) => {
          const serviceItems = clientWork.filter(
            (item) => classifyService(item) === column.key
          );

          acc[column.key] = workHealth(serviceItems, today, next30);
          return acc;
        },
        {} as Record<ServiceBucket, ReturnType<typeof workHealth>>
      );

      return { member, client, services };
    });
  }, [orderedMembers, clientMap, workItems]);

  const upcomingWork = useMemo(() => {
    return openWork
      .filter((item) => {
        if (!item.due_date) return false;
        const due = new Date(`${item.due_date}T00:00:00`);
        const next90 = new Date(today);
        next90.setDate(next90.getDate() + 90);
        return due >= today && due <= next90;
      })
      .slice(0, 8);
  }, [openWork]);

  const relationshipMapMembers = useMemo(() => {
    if (!primaryMember) return orderedMembers;
    return orderedMembers.filter((member) => member.id !== primaryMember.id);
  }, [orderedMembers, primaryMember]);

  async function saveGroup() {
    if (!groupId || !groupName.trim()) return;

    await post({
      action: "update_group",
      groupId,
      groupName: groupName.trim(),
      groupCode: groupCode.trim(),
      notes: groupNotes.trim(),
    });
  }

  async function addMember() {
    if (!newMemberClientId) return;

    const ok = await post({
      action: "add_member",
      groupId,
      clientId: newMemberClientId,
      relationshipLabel: newMemberRelationship.trim(),
      isPrimary: newMemberPrimary,
    });

    if (ok) {
      setNewMemberClientId("");
      setNewMemberRelationship("");
      setNewMemberPrimary(false);
    }
  }

  if (loading) {
    return <div style={page}>Loading group...</div>;
  }

  if (loadError && !group) {
    return (
      <div style={page}>
        <div style={errorBar}>{loadError}</div>
        <Link href="/crm/groups" style={openLink}>
          Back to Client Groups
        </Link>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div style={page}>
      <section style={headerPanel}>
        <div>
          <div style={breadcrumb}>
            <Link href="/crm/groups" style={openLink}>
              Client Groups
            </Link>
            <span>›</span>
            <span>{group.group_name}</span>
          </div>

          <h1 style={title}>{group.group_name}</h1>

          <div style={metaLine}>
            {group.group_code ? <span>Code {group.group_code}</span> : null}
            {group.notes ? <span>{group.notes}</span> : null}
          </div>
        </div>

        <Link href="/crm/groups" style={secondaryLinkButton}>
          Back to groups
        </Link>
      </section>

      {loadError ? <div style={errorBar}>{loadError}</div> : null}

      <nav style={tabBar}>
        {[
          ["overview", "Overview"],
          ["members", "Members"],
          ["work", "Work"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            style={{
              ...tabButton,
              ...(activeView === key ? activeTabButton : {}),
            }}
            onClick={() => setActiveView(key as ViewKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeView === "overview" ? (
        <>
          <section style={summaryGrid}>
            <div style={summaryCell}>
              <span style={summaryLabel}>Members</span>
              <strong style={summaryValue}>{summary.members}</strong>
            </div>

            <div style={summaryCell}>
              <span style={summaryLabel}>Flying Clients</span>
              <strong style={summaryValue}>{summary.flying}</strong>
            </div>

            <div style={summaryCell}>
              <span style={summaryLabel}>Open work</span>
              <strong style={summaryValue}>{summary.open}</strong>
            </div>

            <div style={summaryCell}>
              <span style={summaryLabel}>Overdue</span>
              <strong
                style={{
                  ...summaryValue,
                  ...(summary.overdue > 0 ? { color: "#b42318" } : {}),
                }}
              >
                {summary.overdue}
              </strong>
            </div>

            <div style={summaryCell}>
              <span style={summaryLabel}>Due next 30 days</span>
              <strong style={summaryValue}>{summary.due30}</strong>
            </div>
          </section>

          <div style={cockpitGrid}>
            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Attention required</h2>
                  <div style={panelSubtitle}>
                    Exceptions across the group that need a decision or follow-up.
                  </div>
                </div>
              </div>

              {attentionItems.length ? (
                <div>
                  {attentionItems.map((item, index) => (
                    <div key={`${item.title}-${index}`} style={attentionRow}>
                      <span
                        style={{
                          ...attentionDot,
                          ...(item.level === "high"
                            ? attentionDotHigh
                            : item.level === "medium"
                              ? attentionDotMedium
                              : attentionDotInfo),
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={attentionTitle}>{item.title}</div>
                        <div style={attentionDetail}>{item.detail}</div>
                      </div>

                      {item.clientId ? (
                        <Link
                          href={`/crm/client/${item.clientId}`}
                          style={openLink}
                        >
                          Open →
                        </Link>
                      ) : (
                        <button
                          type="button"
                          style={textButton}
                          onClick={() => setActiveView("members")}
                        >
                          Fix →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={healthyState}>
                  No group exceptions need attention right now.
                </div>
              )}
            </section>

            <section style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Group structure</h2>
                  <div style={panelSubtitle}>
                    The group anchor and how each CRM record is related.
                  </div>
                </div>

                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => setActiveView("members")}
                >
                  Manage
                </button>
              </div>

              <div style={structureBody}>
                {primaryMember ? (
                  <div style={structureAnchor}>
                    <span style={structureLabel}>Primary group anchor</span>
                    <strong style={structureName}>
                      {clientMap.get(primaryMember.client_id)?.client_name || "—"}
                    </strong>
                    <span style={structureMeta}>
                      {primaryMember.relationship_label || "Primary member"}
                    </span>
                  </div>
                ) : (
                  <div style={structureAnchorMissing}>
                    No primary group anchor selected.
                  </div>
                )}

                <div style={structureList}>
                  {orderedMembers.map((member) => {
                    const client = clientMap.get(member.client_id);
                    if (!client) return null;

                    return (
                      <div key={member.id} style={structureRow}>
                        <span style={structureConnector}>↳</span>
                        <div style={{ minWidth: 0 }}>
                          <strong style={structureMemberName}>
                            {client.client_name}
                          </strong>
                          <div style={memberMeta}>
                            {member.relationship_label || "Relationship not set"}
                            {" · "}
                            {categoryLabel(client.client_category)}
                            {" · "}
                            {relationshipLabel(client.relationship_status)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Relationship map</h2>
                <div style={panelSubtitle}>
                  Visual map of how the linked records connect back to the main group anchor.
                </div>
              </div>

              <button
                type="button"
                style={secondaryButton}
                onClick={() => setActiveView("members")}
              >
                Manage links
              </button>
            </div>

            {members.length === 0 ? (
              <div style={emptyState}>No members linked to this group yet.</div>
            ) : primaryMember ? (
              <div style={relationshipDiagram}>
                <div style={relationshipDiagramLeft}>
                  {relationshipMapMembers.length ? (
                    relationshipMapMembers.map((member) => {
                      const client = clientMap.get(member.client_id);
                      if (!client) return null;

                      return (
                        <div key={member.id} style={relationshipRow}>
                          <div style={relationshipCard}>
                            <div style={relationshipCardName}>{client.client_name}</div>
                            <div style={relationshipCardMeta}>
                              {categoryLabel(client.client_category)}
                              {client.entity_type ? ` · ${client.entity_type}` : ""}
                              {client.client_code ? ` · Code ${client.client_code}` : ""}
                            </div>
                            <div style={relationshipCardMeta}>
                              {relationshipLabel(client.relationship_status)}
                            </div>
                          </div>

                          <div style={relationshipConnectorArea}>
                            <div style={relationshipConnectorLine} />
                            <span style={relationshipConnectorLabel}>
                              {member.relationship_label || "Relationship not set"}
                            </span>
                            <div style={relationshipConnectorLine} />
                            <span style={relationshipConnectorDot} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={relationshipStandaloneState}>
                      No linked members besides the primary group anchor yet.
                    </div>
                  )}
                </div>

                <div style={relationshipDiagramRight}>
                  <div style={relationshipAnchorCardLarge}>
                    <span style={relationshipAnchorBadge}>Primary group anchor</span>
                    <strong style={relationshipAnchorNameLarge}>
                      {clientMap.get(primaryMember.client_id)?.client_name || "—"}
                    </strong>
                    <div style={relationshipAnchorMetaLarge}>
                      {(() => {
                        const client = clientMap.get(primaryMember.client_id);
                        if (!client) return "";

                        return `${categoryLabel(client.client_category)}${
                          client.entity_type ? ` · ${client.entity_type}` : ""
                        }${client.client_code ? ` · Code ${client.client_code}` : ""}`;
                      })()}
                    </div>
                    <div style={relationshipAnchorMetaLarge}>
                      {primaryMember.relationship_label || "Primary member"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={relationshipMissingWrap}>
                <div style={structureAnchorMissing}>
                  Choose a primary group anchor to activate the relationship map.
                </div>

                <div style={relationshipUnanchoredGrid}>
                  {orderedMembers.map((member) => {
                    const client = clientMap.get(member.client_id);
                    if (!client) return null;

                    return (
                      <div key={member.id} style={relationshipCard}>
                        <div style={relationshipCardName}>{client.client_name}</div>
                        <div style={relationshipCardMeta}>
                          {member.relationship_label || "Relationship not set"}
                        </div>
                        <div style={relationshipCardMeta}>
                          {categoryLabel(client.client_category)}
                          {client.entity_type ? ` · ${client.entity_type}` : ""}
                          {client.client_code ? ` · Code ${client.client_code}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Group compliance & recurring work matrix</h2>
                <div style={panelSubtitle}>
                  Current work status by member. A dash means there is no matching
                  work item in the current dataset.
                </div>
              </div>
            </div>

            <div style={matrixHeader}>
              <span>Member</span>
              {SERVICE_COLUMNS.map((column) => (
                <span key={column.key}>{column.label}</span>
              ))}
            </div>

            {complianceRows.map(({ member, client, services }) => (
              <div key={member.id} style={matrixRow}>
                <div>
                  <strong style={memberName}>{client.client_name}</strong>
                  <div style={memberMeta}>
                    {categoryLabel(client.client_category)}
                    {client.entity_type ? ` · ${client.entity_type}` : ""}
                  </div>
                </div>

                {SERVICE_COLUMNS.map((column) => {
                  const value = services[column.key];

                  return (
                    <div key={column.key}>
                      <span
                        style={{
                          ...healthBadge,
                          ...(value === "overdue"
                            ? healthOverdue
                            : value === "due_soon"
                              ? healthDueSoon
                              : value === "open"
                                ? healthOpen
                                : value === "clear"
                                  ? healthClear
                                  : healthNone),
                        }}
                      >
                        {healthLabel(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Next 90 days</h2>
                <div style={panelSubtitle}>
                  Upcoming group work that is close enough to plan for now.
                </div>
              </div>

              <button
                type="button"
                style={secondaryButton}
                onClick={() => setActiveView("work")}
              >
                View all work
              </button>
            </div>

            <WorkTable
              rows={upcomingWork}
              clientMap={clientMap}
              today={today}
            />
          </section>
        </>
      ) : null}

      {activeView === "members" ? (
        <>
          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Group details</h2>
                <div style={panelSubtitle}>
                  Maintain the group name, code and description.
                </div>
              </div>

              <button
                type="button"
                style={primaryButton}
                onClick={saveGroup}
                disabled={saving}
              >
                Save
              </button>
            </div>

            <div style={editGrid}>
              <label style={field}>
                <span style={label}>Group name</span>
                <input
                  style={input}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                />
              </label>

              <label style={field}>
                <span style={label}>Group code</span>
                <input
                  style={input}
                  value={groupCode}
                  onChange={(event) => setGroupCode(event.target.value)}
                />
              </label>

              <label style={field}>
                <span style={label}>Notes</span>
                <input
                  style={input}
                  value={groupNotes}
                  onChange={(event) => setGroupNotes(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Add group member</h2>
                <div style={panelSubtitle}>
                  Link any Practice Airspace record to this group.
                </div>
              </div>
            </div>

            <div style={addMemberGrid}>
              <select
                style={input}
                value={newMemberClientId}
                onChange={(event) => setNewMemberClientId(event.target.value)}
              >
                <option value="">Select CRM record...</option>
                {availableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_name}
                  </option>
                ))}
              </select>

              <input
                style={input}
                value={newMemberRelationship}
                onChange={(event) =>
                  setNewMemberRelationship(event.target.value)
                }
                placeholder="Relationship label, e.g. Group owner"
              />

              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={newMemberPrimary}
                  onChange={(event) =>
                    setNewMemberPrimary(event.target.checked)
                  }
                />
                Primary
              </label>

              <button
                type="button"
                style={primaryButton}
                onClick={addMember}
                disabled={saving || !newMemberClientId}
              >
                Add
              </button>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Members</h2>
                <div style={panelSubtitle}>
                  Set the group anchor or remove outdated links.
                </div>
              </div>
            </div>

            <div style={memberManageHeader}>
              <span>Member</span>
              <span>Relationship</span>
              <span>Status</span>
              <span>Primary</span>
              <span />
            </div>

            {orderedMembers.map((member) => {
              const client = clientMap.get(member.client_id);
              if (!client) return null;

              return (
                <div key={member.id} style={memberManageRow}>
                  <div>
                    <strong style={memberName}>{client.client_name}</strong>
                    <div style={memberMeta}>
                      {categoryLabel(client.client_category)}
                      {client.entity_type ? ` · ${client.entity_type}` : ""}
                      {client.client_code ? ` · ${client.client_code}` : ""}
                    </div>
                  </div>

                  <div style={cellText}>
                    {member.relationship_label || "—"}
                  </div>

                  <div style={cellText}>
                    {relationshipLabel(client.relationship_status)}
                  </div>

                  <div>
                    {member.is_primary ? (
                      <span style={primaryBadge}>Primary</span>
                    ) : (
                      <button
                        type="button"
                        style={textButton}
                        onClick={() =>
                          post({
                            action: "set_primary",
                            groupId,
                            memberId: member.id,
                          })
                        }
                      >
                        Make primary
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    style={dangerButton}
                    onClick={() =>
                      post({
                        action: "remove_member",
                        memberId: member.id,
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </section>
        </>
      ) : null}

      {activeView === "work" ? (
        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Group work</h2>
              <div style={panelSubtitle}>
                Open work across every linked member, ordered by due date.
              </div>
            </div>
          </div>

          <WorkTable rows={openWork} clientMap={clientMap} today={today} />
        </section>
      ) : null}
    </div>
  );
}

function MemberTable({
  members,
  clientMap,
  memberStats,
}: {
  members: MemberRow[];
  clientMap: Map<string, ClientRow>;
  memberStats: Map<string, { open: number; overdue: number; due30: number }>;
}) {
  return (
    <>
      <div style={memberHeader}>
        <span>Member</span>
        <span>Relationship</span>
        <span>PracticePilot status</span>
        <span>Open</span>
        <span>Overdue</span>
        <span>Next 30 days</span>
        <span />
      </div>

      {members.length ? (
        members.map((member) => {
          const client = clientMap.get(member.client_id);
          const stats = memberStats.get(member.client_id) || {
            open: 0,
            overdue: 0,
            due30: 0,
          };

          if (!client) return null;

          return (
            <div key={member.id} style={memberRow}>
              <div>
                <div style={memberNameLine}>
                  <strong style={memberName}>{client.client_name}</strong>
                  {member.is_primary ? (
                    <span style={primaryBadge}>Primary</span>
                  ) : null}
                </div>

                <div style={memberMeta}>
                  {categoryLabel(client.client_category)}
                  {client.entity_type ? ` · ${client.entity_type}` : ""}
                  {client.client_code ? ` · ${client.client_code}` : ""}
                </div>
              </div>

              <div style={cellText}>
                {member.relationship_label || "—"}
              </div>

              <div style={cellText}>
                {relationshipLabel(client.relationship_status)}
              </div>

              <div style={numberCell}>{stats.open}</div>

              <div style={stats.overdue > 0 ? overdueNumber : numberCell}>
                {stats.overdue}
              </div>

              <div style={numberCell}>{stats.due30}</div>

              <Link href={`/crm/client/${client.id}`} style={openLink}>
                Open →
              </Link>
            </div>
          );
        })
      ) : (
        <div style={emptyState}>No active members are linked to this group.</div>
      )}
    </>
  );
}

function WorkTable({
  rows,
  clientMap,
  today,
}: {
  rows: WorkRow[];
  clientMap: Map<string, ClientRow>;
  today: Date;
}) {
  return (
    <>
      <div style={workHeader}>
        <span>Due</span>
        <span>Client / record</span>
        <span>Work</span>
        <span>Service</span>
        <span>Status</span>
        <span />
      </div>

      {rows.length ? (
        rows.map((item) => {
          const client = clientMap.get(item.client_id);
          const overdue =
            item.due_date &&
            new Date(`${item.due_date}T00:00:00`) < today;

          return (
            <div key={item.id} style={workRow}>
              <div style={overdue ? overdueDue : cellText}>
                {item.due_date || "—"}
              </div>

              <strong style={workClient}>
                {client?.client_name || "Unknown record"}
              </strong>

              <div style={cellText}>{item.title || "Untitled work"}</div>
              <div style={cellText}>{item.service_code || "—"}</div>
              <div style={cellText}>{item.status || "Open"}</div>

              <Link
                href={`/crm/client/${item.client_id}?tab=work`}
                style={openLink}
              >
                Open →
              </Link>
            </div>
          );
        })
      ) : (
        <div style={emptyState}>No outstanding work across this group.</div>
      )}
    </>
  );
}

const page: React.CSSProperties = {
  minHeight: "100%",
  padding: "8px 10px 28px",
  background: "#eef2f5",
  color: "#10233a",
};

const headerPanel: React.CSSProperties = {
  minHeight: "76px",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const breadcrumb: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  color: "#64748b",
  fontSize: "9px",
};

const title: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "20px",
  fontWeight: 900,
};

const metaLine: React.CSSProperties = {
  marginTop: "4px",
  display: "flex",
  gap: "10px",
  color: "#64748b",
  fontSize: "9px",
};

const tabBar: React.CSSProperties = {
  marginTop: "8px",
  minHeight: "38px",
  display: "flex",
  alignItems: "stretch",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const tabButton: React.CSSProperties = {
  minWidth: "100px",
  padding: "0 12px",
  border: "none",
  borderRight: "1px solid #d8dee7",
  background: "#ffffff",
  color: "#526174",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const activeTabButton: React.CSSProperties = {
  background: "#10233a",
  color: "#ffffff",
};

const summaryGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  border: "1px solid #d8dee7",
  background: "#ffffff",
};

const summaryCell: React.CSSProperties = {
  minHeight: "56px",
  padding: "8px 10px",
  display: "grid",
  alignContent: "center",
  borderRight: "1px solid #e3e8ee",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  marginTop: "1px",
  fontSize: "17px",
  fontWeight: 900,
};

const panel: React.CSSProperties = {
  marginTop: "8px",
  background: "#ffffff",
  border: "1px solid #d8dee7",
};

const panelHeader: React.CSSProperties = {
  minHeight: "48px",
  padding: "7px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #d8dee7",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 900,
};

const panelSubtitle: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "9px",
};

const memberHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(280px, 1.5fr) minmax(150px, .8fr) minmax(150px, .8fr) 70px 70px 90px 70px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const memberRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns:
    "minmax(280px, 1.5fr) minmax(150px, .8fr) minmax(150px, .8fr) 70px 70px 90px 70px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const memberNameLine: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  alignItems: "center",
};

const memberName: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const memberMeta: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const primaryBadge: React.CSSProperties = {
  padding: "2px 4px",
  border: "1px solid #bfd4ec",
  background: "#eef5fc",
  color: "#1758d5",
  fontSize: "7px",
  fontWeight: 850,
};

const cellText: React.CSSProperties = {
  fontSize: "9px",
};

const numberCell: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
};

const overdueNumber: React.CSSProperties = {
  ...numberCell,
  color: "#b42318",
};

const workHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns:
    "105px minmax(190px, .8fr) minmax(280px, 1.4fr) 120px 120px 70px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const workRow: React.CSSProperties = {
  minHeight: "40px",
  padding: "4px 10px",
  display: "grid",
  gridTemplateColumns:
    "105px minmax(190px, .8fr) minmax(280px, 1.4fr) 120px 120px 70px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const workClient: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 850,
};

const overdueDue: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
  color: "#b42318",
};

const editGrid: React.CSSProperties = {
  padding: "9px 10px",
  display: "grid",
  gridTemplateColumns: "1fr .5fr 1.4fr",
  gap: "8px",
};

const addMemberGrid: React.CSSProperties = {
  padding: "9px 10px",
  display: "grid",
  gridTemplateColumns: "1.4fr 1.2fr 90px 70px",
  gap: "8px",
  alignItems: "center",
};

const memberManageHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr 110px 70px",
  gap: "8px",
  alignItems: "center",
  background: "#f7f9fb",
  borderBottom: "1px solid #d8dee7",
  color: "#526174",
  fontSize: "8px",
  fontWeight: 850,
};

const memberManageRow: React.CSSProperties = {
  minHeight: "44px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr 110px 70px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const label: React.CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  height: "30px",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 0,
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const checkboxLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "9px",
  fontWeight: 800,
};

const primaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryLinkButton: React.CSSProperties = {
  height: "30px",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#10233a",
  textDecoration: "none",
  fontSize: "9px",
  fontWeight: 850,
};

const textButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  ...textButton,
  color: "#b42318",
};

const openLink: React.CSSProperties = {
  color: "#1758d5",
  textDecoration: "none",
  fontSize: "8px",
  fontWeight: 850,
};

const emptyState: React.CSSProperties = {
  padding: "16px 10px",
  color: "#64748b",
  fontSize: "9px",
};

const cockpitGrid: React.CSSProperties = {
  marginTop: "8px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, .8fr)",
  gap: "8px",
};

const attentionRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "6px 10px",
  display: "grid",
  gridTemplateColumns: "10px minmax(0, 1fr) 60px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const attentionDot: React.CSSProperties = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
};

const attentionDotHigh: React.CSSProperties = {
  background: "#b42318",
};

const attentionDotMedium: React.CSSProperties = {
  background: "#b7791f",
};

const attentionDotInfo: React.CSSProperties = {
  background: "#1758d5",
};

const attentionTitle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
};

const attentionDetail: React.CSSProperties = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const healthyState: React.CSSProperties = {
  padding: "18px 10px",
  color: "#166534",
  background: "#f0fdf4",
  fontSize: "9px",
  fontWeight: 800,
};

const structureBody: React.CSSProperties = {
  padding: "8px 10px 10px",
};

const structureAnchor: React.CSSProperties = {
  padding: "8px 9px",
  border: "1px solid #cbd5e1",
  background: "#f7f9fb",
};

const structureAnchorMissing: React.CSSProperties = {
  padding: "8px 9px",
  border: "1px solid #f0c36b",
  background: "#fff8e6",
  color: "#8a5a00",
  fontSize: "9px",
  fontWeight: 800,
};

const structureLabel: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 800,
};

const structureName: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  fontSize: "11px",
};

const structureMeta: React.CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
};

const structureList: React.CSSProperties = {
  marginTop: "6px",
};

const structureRow: React.CSSProperties = {
  minHeight: "34px",
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const structureConnector: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
};

const structureMemberName: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 900,
};

const matrixHeader: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.6fr) repeat(6, minmax(95px, .55fr))",
  gap: "7px",
  alignItems: "center",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const matrixRow: React.CSSProperties = {
  minHeight: "46px",
  padding: "5px 10px",
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.6fr) repeat(6, minmax(95px, .55fr))",
  gap: "7px",
  alignItems: "center",
  borderBottom: "1px solid #e5eaf0",
};

const healthBadge: React.CSSProperties = {
  display: "inline-flex",
  minWidth: "58px",
  minHeight: "22px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 5px",
  border: "1px solid transparent",
  fontSize: "8px",
  fontWeight: 850,
};

const healthOverdue: React.CSSProperties = {
  color: "#991b1b",
  background: "#fff1f2",
  borderColor: "#fecaca",
};

const healthDueSoon: React.CSSProperties = {
  color: "#8a5a00",
  background: "#fff8e6",
  borderColor: "#f0c36b",
};

const healthOpen: React.CSSProperties = {
  color: "#1758d5",
  background: "#eef5fc",
  borderColor: "#bfd4ec",
};

const healthClear: React.CSSProperties = {
  color: "#166534",
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
};

const healthNone: React.CSSProperties = {
  color: "#64748b",
  background: "#f8fafc",
  borderColor: "#e2e8f0",
};

const relationshipDiagram: React.CSSProperties = {
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) 320px",
  gap: "14px",
  alignItems: "stretch",
};

const relationshipDiagramLeft: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  alignContent: "start",
};

const relationshipDiagramRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const relationshipRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 240px",
  gap: "10px",
  alignItems: "center",
};

const relationshipCard: React.CSSProperties = {
  minHeight: "68px",
  padding: "10px 12px",
  border: "1px solid #d5dde7",
  background: "#fbfdff",
};

const relationshipCardName: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 900,
};

const relationshipCardMeta: React.CSSProperties = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "8px",
};

const relationshipConnectorArea: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr 12px",
  gap: "7px",
  alignItems: "center",
};

const relationshipConnectorLine: React.CSSProperties = {
  height: "2px",
  background: "#bfd4ec",
};

const relationshipConnectorLabel: React.CSSProperties = {
  display: "inline-flex",
  minHeight: "24px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  border: "1px solid #bfd4ec",
  background: "#eef5fc",
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const relationshipConnectorDot: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#1758d5",
};

const relationshipAnchorCardLarge: React.CSSProperties = {
  width: "100%",
  minHeight: "164px",
  padding: "14px 16px",
  border: "1px solid #bfd4ec",
  background: "#f7fbff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const relationshipAnchorBadge: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  minHeight: "22px",
  alignItems: "center",
  padding: "0 8px",
  border: "1px solid #bfd4ec",
  background: "#eef5fc",
  color: "#1758d5",
  fontSize: "8px",
  fontWeight: 900,
};

const relationshipAnchorNameLarge: React.CSSProperties = {
  display: "block",
  marginTop: "10px",
  fontSize: "13px",
  lineHeight: 1.35,
};

const relationshipAnchorMetaLarge: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "8px",
};

const relationshipMissingWrap: React.CSSProperties = {
  padding: "10px",
};

const relationshipUnanchoredGrid: React.CSSProperties = {
  marginTop: "10px",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const relationshipStandaloneState: React.CSSProperties = {
  minHeight: "84px",
  padding: "18px 12px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: "9px",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const errorBar: React.CSSProperties = {
  marginTop: "8px",
  padding: "9px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: "9px",
  fontWeight: 800,
};
