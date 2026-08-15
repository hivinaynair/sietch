"use client";

import { type Seat, seatLabel } from "./clip";

export type SeatSide = "sending" | "beneficiary";

const SIDE_SEATS: Record<SeatSide, readonly [Seat, Seat]> = {
  sending: ["chani", "chani-institution"],
  beneficiary: ["paul", "paul-institution"],
};

const SIDE_LABEL: Record<SeatSide, string> = {
  sending: "Sending side",
  beneficiary: "Beneficiary side",
};

const SEAT_KIND: Record<Seat, string> = {
  chani: "customer",
  "chani-institution": "institution",
  paul: "customer",
  "paul-institution": "institution",
};

/**
 * One cluster per side, so the control sits above the institution it speaks for.
 * Four seats, one world — switching seats never forks chain state.
 */
export function SeatSwitcher({
  side,
  seat,
  onSeat,
  align = "left",
}: {
  side: SeatSide;
  seat: Seat;
  onSeat: (next: Seat) => void;
  align?: "left" | "right";
}) {
  const seats = SIDE_SEATS[side];
  const holdsSeat = seats.includes(seat);

  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p
        className={`text-[10.5px] uppercase tracking-[0.14em] transition-colors ${
          holdsSeat ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {SIDE_LABEL[side]}
      </p>
      <fieldset
        className={`mt-2 inline-flex rounded-full border border-border bg-card p-[3px] ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <legend className="sr-only">{SIDE_LABEL[side]}</legend>
        {seats.map((s) => {
          const active = seat === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              title={`${seatLabel(s)} · ${SEAT_KIND[s]}`}
              onClick={() => onSeat(s)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {seatLabel(s)}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
