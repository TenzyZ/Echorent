# UI direction

## Purpose

This document gives the direction for the EchoRent UI. Engineers use it when they build the screen.

The app has one full-screen stage. The app has no pages.

## Layout

The stage holds these zones, from top to bottom:

1. A small EchoRent mark, top left.
2. An overflow menu, top right.
3. A serif headline in the center. Use "Where are you heading?" and "Tell me about your trip." The headline shows only before the first car set appears.
4. The car results, above the controls. The results are cards in a horizontal slider.
5. A live transcript strip.
6. The voice orb, with a state label.
7. A bottom dock, with a keyboard button, a microphone button, and an end-call button.

The dock never moves.

## Color

The background is warm ivory, `#F5F3F0`. The text is charcoal. The orb is champagne. Do not use blue accents. Use the color tokens in `src/index.css`.

## Type

Headlines use the editorial serif stack: `New York, Georgia, serif`. Labels use the system sans font.

## The orb

The orb carries a state label. The label shows the current phase. The orb brightens during the listening phase. The orb dims during the idle phase.

## The car results

The agent offers one or more cars. The cards sit in a horizontal slider. One card fills the row. The user swipes right for the next card. Dots under the slider show the position. Each card carries a "View details" control and a dismiss control. A new offer replaces the whole card set.

## The bottom sheet

"View details" opens a bottom sheet. The sheet shows the dates, the passengers, the luggage, and the selected car. The sheet stays hidden until a trip detail exists.

## Motion

Car cards fade in and rise. The orb brightens and dims with the phase.

## State machine

The stage is always in one phase. The phases are `idle`, `listening`, `thinking`, and `speaking`.

| Phase | Meaning |
| --- | --- |
| `idle` | The session waits for the user. |
| `listening` | The user speaks. |
| `thinking` | The agent prepares the reply. |
| `speaking` | The agent speaks. |

Set the current phase on `data-phase`. The CSS keys off `data-phase`.

## Governing rule

Voice stays available at every moment. Information gets screen space only when it helps the conversation.
