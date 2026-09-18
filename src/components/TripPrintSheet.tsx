"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  dayHeading,
  dayTotal,
  itemKindMeta,
  itemPartyCost,
  sortDayItems,
  totalsByKind,
  tripTotal,
  type Trip,
} from "@/lib/travel/itinerary/trips";

/**
 * Print-only rendering of a trip, used for "Export PDF" via the browser's own
 * print-to-PDF. Text stays selectable and multi-page flow is handled by the engine,
 * which a canvas-rasterising library wouldn't give us.
 *
 * Portalled to <body> on purpose: the builder sits several scroll containers deep, and
 * printing a nested element gets clipped to one page. As a direct body child it can be
 * isolated with a single rule (see .trip-print in globals.css).
 */

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function dateRange(trip: Trip): string {
  if (trip.days.length === 0) return "";
  const first = dayHeading(trip.days[0].date);
  if (trip.days.length === 1) return first;
  return `${first} – ${dayHeading(trip.days[trip.days.length - 1].date)}`;
}

/** The document itself — pure, so it can be rendered outside the browser too. */
export function TripPrintDocument({ trip }: { trip: Trip }) {
  const total = tripTotal(trip);
  const perHead = total / Math.max(1, trip.travellers);
  const kinds = totalsByKind(trip);
  const nights = Math.max(0, trip.days.length - 1);

  return (
    <div className="trip-print" aria-hidden="true">
      <header className="tp-head">
        <h1>{trip.name || "Trip"}</h1>
        <p className="tp-sub">
          {[trip.destination, dateRange(trip)].filter(Boolean).join(" · ")}
        </p>
        <p className="tp-sub">
          {trip.days.length} day{trip.days.length === 1 ? "" : "s"}
          {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""} · {trip.travellers} traveller
          {trip.travellers === 1 ? "" : "s"}
        </p>
      </header>

      <section className="tp-summary">
        <div className="tp-stat">
          <span className="tp-stat-label">Total</span>
          <span className="tp-stat-value">{money(total)}</span>
        </div>
        <div className="tp-stat">
          <span className="tp-stat-label">Per person</span>
          <span className="tp-stat-value">{money(perHead)}</span>
        </div>
        {kinds.map((k) => (
          <div className="tp-stat" key={k.kind}>
            <span className="tp-stat-label">{k.label}</span>
            <span className="tp-stat-value">{money(k.inr)}</span>
          </div>
        ))}
      </section>

      {trip.notes && <p className="tp-notes">{trip.notes}</p>}

      {trip.days.map((day, i) => {
        const items = sortDayItems(day.items);
        const dTotal = dayTotal(day, trip.travellers);
        const photos = items.flatMap((it) =>
          it.attachments.filter((a) => a.kind === "photo").map((a) => ({ ...a, item: it.title }))
        );

        return (
          <section className="tp-day" key={day.id}>
            <h2>
              <span className="tp-daynum">Day {i + 1}</span>
              {dayHeading(day.date)}
              {day.label ? <span className="tp-daylabel"> · {day.label}</span> : null}
            </h2>

            {items.length === 0 ? (
              <p className="tp-empty">Nothing planned.</p>
            ) : (
              <table className="tp-table">
                <thead>
                  <tr>
                    <th className="tp-w-time">Time</th>
                    <th>Item</th>
                    <th className="tp-w-ref">Ref</th>
                    <th className="tp-w-cost">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = itemKindMeta(item.kind);
                    const links = item.attachments.filter((a) => a.kind === "link");
                    return (
                      <tr key={item.id}>
                        <td className="tp-w-time">
                          {item.startTime || "—"}
                          {item.endTime ? (
                            <>
                              <br />
                              <span className="tp-dim">
                                to {item.endTime}
                                {item.endsNextDay ? " +1d" : ""}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <span className="tp-kind">{meta.label}</span>
                          <span className="tp-title">{item.title || meta.label}</span>
                          {item.booked && <span className="tp-booked">booked</span>}
                          {(item.from || item.to) && (
                            <div className="tp-route">
                              {item.from || "?"} → {item.to || "?"}
                            </div>
                          )}
                          {item.notes && <div className="tp-itemnote">{item.notes}</div>}
                          {links.map((l) => (
                            <div className="tp-link" key={l.id}>
                              {l.label ? `${l.label}: ` : ""}
                              {l.url}
                            </div>
                          ))}
                        </td>
                        <td className="tp-w-ref tp-dim">{item.bookingRef || "—"}</td>
                        <td className="tp-w-cost tp-num">
                          {item.costInr ? (
                            <>
                              {money(itemPartyCost(item, trip.travellers))}
                              {item.costBasis === "person" && trip.travellers > 1 && (
                                <>
                                  <br />
                                  <span className="tp-dim">{money(item.costInr)} ea</span>
                                </>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {dTotal > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Day {i + 1} total</td>
                      <td className="tp-num">{money(dTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {photos.length > 0 && (
              <div className="tp-photos">
                {photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.url} alt={p.label || p.item} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="tp-total">
        <span>Trip total</span>
        <span className="tp-num">
          {money(total)}
          {trip.travellers > 1 ? ` · ${money(perHead)} per person` : ""}
        </span>
      </section>

      <footer className="tp-foot">
        Generated {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
      </footer>
    </div>
  );
}

export function TripPrintSheet({ trip }: { trip: Trip }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<TripPrintDocument trip={trip} />, document.body);
}
