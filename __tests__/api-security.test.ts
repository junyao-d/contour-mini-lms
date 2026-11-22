import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeRedirectPath } from "@/lib/api/redirect";
import { parseJsonBody } from "@/lib/api/request";
import { ApiError, handleApiError } from "@/lib/api/response";
import { MIN_CONSULTATION_GAP_MINUTES } from "@/lib/domain/consultation-constants";

const mockRequireAuth = vi.fn();
const mockRequireStudent = vi.fn();
const mockRequireAdmin = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireStudent: (...args: unknown[]) => mockRequireStudent(...args),
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

import { GET as getMe } from "@/app/api/me/route";
import { POST as createConsultation } from "@/app/api/consultations/route";
import { GET as getAdminConsultations } from "@/app/api/admin/consultations/route";
import { PATCH as patchConsultation } from "@/app/api/consultations/[id]/route";

describe("redirect & request security helpers", () => {
  it("blocks open redirect attempts including backslash tricks", () => {
    expect(getSafeRedirectPath("/dashboard?tab=scheduled")).toBe(
      "/dashboard?tab=scheduled",
    );
    expect(getSafeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(getSafeRedirectPath(null, "/admin")).toBe("/admin");
  });

  it("enforces application/json Content-Type and same-origin Origin header", async () => {
    const nonJsonReq = new NextRequest("http://localhost:3000/api/consultations", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(parseJsonBody(nonJsonReq)).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });

    const crossOriginReq = new NextRequest(
      "http://localhost:3000/api/consultations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "https://evil.example.com",
        },
        body: JSON.stringify({ ok: true }),
      },
    );
    await expect(parseJsonBody(crossOriginReq)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });

    const validReq = new NextRequest("http://localhost:3000/api/consultations", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ hello: "world" }),
    });
    await expect(parseJsonBody(validReq)).resolves.toEqual({ hello: "world" });
  });

  it("maps Postgres 23P01 exclusion violation to 409 TIME_SLOT_CONFLICT", async () => {
    const response = handleApiError({ code: "23P01" });
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe("TIME_SLOT_CONFLICT");
    expect(json.error.message).toContain(
      `${MIN_CONSULTATION_GAP_MINUTES} minutes`,
    );
  });
});

describe("API Route Handler RBAC & concurrency behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 on /api/me when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(
      new ApiError(401, "UNAUTHORIZED", "Authentication required."),
    );

    const res = await getMe();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when a student accesses /api/admin/consultations", async () => {
    mockRequireAdmin.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "Admin access is required."),
    );

    const req = new NextRequest("http://localhost:3000/api/admin/consultations");
    const res = await getAdminConsultations(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when an admin attempts to book via POST /api/consultations", async () => {
    mockRequireStudent.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "Student access is required."),
    );

    const req = new NextRequest("http://localhost:3000/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await createConsultation(req);
    expect(res.status).toBe(403);
  });

  it("returns 201 on a valid student booking", async () => {
    const createdRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000099",
      user_id: "22222222-2222-4222-8222-222222222222",
      first_name: "Alice",
      last_name: "Chen",
      reason: "Exam prep",
      scheduled_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
    };

    const single = vi.fn().mockResolvedValue({ data: createdRow, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    mockRequireStudent.mockResolvedValueOnce({
      supabase: { from },
      user: { id: createdRow.user_id },
      profile: { id: createdRow.user_id, role: "student" },
    });

    const req = new NextRequest("http://localhost:3000/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        first_name: "Alice",
        last_name: "Chen",
        reason: "Exam prep",
        scheduled_at: createdRow.scheduled_at,
      }),
    });

    const res = await createConsultation(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(createdRow.id);
  });

  it("returns 409 CONCURRENT_MODIFICATION if row changed between read and PATCH update", async () => {
    const consultationId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
    const userId = "22222222-2222-4222-8222-222222222222";
    const existingRow = {
      id: consultationId,
      user_id: userId,
      status: "scheduled",
      scheduled_at: "2026-11-25T10:00:00.000Z",
      updated_at: "2026-11-22T09:00:00.000Z",
    };

    const selectMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: existingRow, error: null });
    const updateMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });

    const from = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: selectMaybeSingle }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({ maybeSingle: updateMaybeSingle }),
              }),
            }),
          }),
        }),
      }),
    });

    mockRequireStudent.mockResolvedValueOnce({
      supabase: { from },
      user: { id: userId },
      profile: { id: userId, role: "student" },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/consultations/${consultationId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      },
    );

    const res = await patchConsultation(req, {
      params: Promise.resolve({ id: consultationId }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONCURRENT_MODIFICATION");
  });
});
