# 4. v1 flags all seven researched clause types and prefers over-flagging

v1 flags arbitration and class-action waivers, auto-renewal, fee escalators and
late fees, unilateral modification, liability caps, indemnity, and non-competes.
Where the analysis is unsure, it flags rather than stays silent, and the excess
lands at low severity instead of the top of the list.

## Why

A false positive is visible and checkable: the reader reads the cited sentence and
disagrees, and the cost is a little credibility. A false negative is invisible
forever — the reader signs and never learns what was missed. The CFPB finding that
motivated this product (three quarters of consumers did not know their contract
contained an arbitration clause) is a false-negative problem.

## Consequences

- Three of the seven types (liability caps, indemnity, non-competes) rest on
  weaker evidence than the other four; flag quality will not be uniform.
- Lists get longer, and readers skim tails.
- A document with no qualifying flag is reported clean *with the list of what was
  checked*. An empty screen is indistinguishable from a failed parse.
