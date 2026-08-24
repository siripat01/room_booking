import Elysia, { t } from "elysia";
import prisma from "../../libs/db";
import { requestCorrelationId } from "../lib/request-correlation";
import { betterAuth } from "../middleware/auth.middleware";
import { isBookingSeriesError } from "./booking-series.errors";
import { BookingSeriesService } from "./booking-series.service";

const service = new BookingSeriesService(prisma);

const weekday = t.Union([
  t.Literal("SUNDAY"),
  t.Literal("MONDAY"),
  t.Literal("TUESDAY"),
  t.Literal("WEDNESDAY"),
  t.Literal("THURSDAY"),
  t.Literal("FRIDAY"),
  t.Literal("SATURDAY"),
]);

const templateBody = t.Object({
  roomId: t.String({ minLength: 1 }),
  startDate: t.String({ minLength: 10, maxLength: 10 }),
  endDate: t.String({ minLength: 10, maxLength: 10 }),
  weekdays: t.Array(weekday, { minItems: 1, maxItems: 7 }),
  startTime: t.String({ minLength: 5, maxLength: 5 }),
  endTime: t.String({ minLength: 5, maxLength: 5 }),
  attendees: t.Number({ minimum: 1, maximum: 500 }),
  purpose: t.Optional(t.String({ maxLength: 500 })),
});

const templatePatchBody = t.Object({
  roomId: t.Optional(t.String({ minLength: 1 })),
  endDate: t.Optional(t.String({ minLength: 10, maxLength: 10 })),
  weekdays: t.Optional(t.Array(weekday, { minItems: 1, maxItems: 7 })),
  startTime: t.Optional(t.String({ minLength: 5, maxLength: 5 })),
  endTime: t.Optional(t.String({ minLength: 5, maxLength: 5 })),
  attendees: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
  purpose: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
});

function actor(user: { id: string; role?: string | null }, request: Request) {
  return {
    userId: user.id,
    role: user.role ?? "userRole",
    correlationId: requestCorrelationId(request),
  };
}

export const bookingSeriesRoutes = new Elysia({ prefix: "/booking-series" })
  .use(betterAuth)
  .onError(({ error, status }) => {
    if (!isBookingSeriesError(error)) return;
    const statusCode =
      error.code === "UNAUTHORIZED" || error.code === "PRO_REQUIRED"
        ? 403
        : error.code === "SERIES_NOT_FOUND" || error.code === "OCCURRENCE_NOT_FOUND"
          ? 404
          : error.code === "SERIES_CONFLICT"
            ? 409
            : 400;
    return status(statusCode, {
      error: error.message,
      code: error.code,
      conflicts: error.conflicts,
    });
  })
  .get("/", ({ user, request }) => service.list(actor(user, request)), { auth: true })
  .post("/preview", ({ user, request, body }) => service.preview(body, actor(user, request)), {
    auth: true,
    body: templateBody,
  })
  .post("/", ({ user, request, body }) => service.create(body, actor(user, request)), {
    auth: true,
    body: templateBody,
  })
  .get("/:seriesId", ({ user, request, params }) =>
    service.getById(params.seriesId, actor(user, request)), { auth: true })
  .patch(
    "/:seriesId",
    ({ user, request, params, body }) =>
      service.editSeries(
        params.seriesId,
        body.scope,
        body.patch,
        actor(user, request),
        body.fromBookingId,
      ),
    {
      auth: true,
      body: t.Object({
        scope: t.Union([t.Literal("THIS_AND_FUTURE"), t.Literal("WHOLE_SERIES")]),
        fromBookingId: t.Optional(t.String()),
        patch: templatePatchBody,
      }),
    },
  )
  .post(
    "/:seriesId/cancel",
    ({ user, request, params, body }) =>
      service.cancelSeries(
        params.seriesId,
        body.scope,
        actor(user, request),
        body.fromBookingId,
      ),
    {
      auth: true,
      body: t.Object({
        scope: t.Union([t.Literal("FUTURE"), t.Literal("ENTIRE")]),
        fromBookingId: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:seriesId/occurrences/:bookingId",
    ({ user, request, params, body }) =>
      service.editOccurrence(
        params.seriesId,
        params.bookingId,
        body,
        actor(user, request),
      ),
    {
      auth: true,
      body: t.Object({
        roomId: t.Optional(t.String({ minLength: 1 })),
        date: t.Optional(t.String({ minLength: 10, maxLength: 10 })),
        startTime: t.Optional(t.String({ minLength: 5, maxLength: 5 })),
        endTime: t.Optional(t.String({ minLength: 5, maxLength: 5 })),
        attendees: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
        purpose: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
      }),
    },
  )
  .delete(
    "/:seriesId/occurrences/:bookingId",
    ({ user, request, params }) =>
      service.cancelOccurrence(
        params.seriesId,
        params.bookingId,
        actor(user, request),
      ),
    { auth: true },
  );
