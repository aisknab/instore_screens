# In-Store Screens for Criteo Retail Media: Technical Explanation

## 1. What This Proposal Is Trying to Show

The point of this project is not "a demo website with some screens in it." The point is to show that in-store digital screens can be treated as a natural extension of Criteo's existing retail media model rather than as a separate store-tech product.

The core proposal is:

- physical in-store screens become retail media supply
- that supply can be modeled using concepts that already exist in CYield today
- buying can work in a way that is structurally similar to onsite retail media buying
- monitoring can combine delivery proof, shopper engagement signals, and retail outcome modeling in one loop

At a high level, the repo demonstrates an operating model where the store becomes another addressable media environment inside the same retail media system.

## 2. The Strategic Fit with Current Criteo Retail Media

The cleanest way to understand the proposal is to compare it to onsite.

Today, onsite retail media already works around a familiar pattern:

- a retailer exposes supply
- that supply is described in terms of pages, placements, and delivery rules
- buying selects where and how to activate against that supply
- delivery returns creative payloads
- measurement reports what ran and how it performed

This project proposes that in-store screens can fit into the same pattern with minimal conceptual change.

Instead of inventing a separate supply stack, the model is:

- treat each in-store screen as another supply surface
- describe that screen in CYield-like terms
- let a shared player request delivery payloads from the middleware
- let buying and monitoring reason about store inventory the same way they already reason about onsite inventory

That is why the supply setup in this repo is intentionally similar to CYield rather than resembling digital signage software.

## 3. The Supply Model: How In-Store Screens Map to CYield

The most important supply idea in the repo is that a physical screen can be represented using the same mental model as an onsite placement.

The demo expresses this with three concepts:

- `Page`
- `Screen`
- `Template`

### 3.1 `Page` as the store-side equivalent of an onsite page or placement context

In the proposal, a page is not literally a web page. It is the logical retail context where media can run.

Examples:

- `ENTRANCE`
- `ELECTRONICS`
- `WHITEGOODS`
- `AISLE`
- `CHECKOUT`

This is the key abstraction:

- an onsite page is a shopper context in digital commerce
- an in-store page is a shopper context on the shop floor

So "page" becomes a reusable supply primitive across environments.

### 3.2 `Screen` as the physical placement attached to that page context

A screen record carries the physical information needed to actually deliver:

- store ID
- location
- page mapping
- screen type
- screen size
- refresh interval
- delivery share configuration
- line items

This is equivalent to saying:

- the page defines the logical supply context
- the screen defines the actual installed media surface inside that context

So if CYield today knows how to reason about pages and placements, the proposal is that it can reason about screens without changing its underlying mental model very much.

### 3.3 `Template` as the in-store equivalent of format / placement behavior

Templates describe how a given screen placement behaves visually and operationally.

Examples in the repo:

- fullscreen banner
- fullscreen hero
- carousel banner
- kiosk
- shelf spotlight
- menu loop

These are the in-store equivalent of saying:

- this is not just "creative"
- this is the expected behavior of a particular placement type

That is important because in-store media has different viewing conditions from onsite:

- some screens are passive and distant
- some are portrait
- some are shelf-edge
- some are queue-side or kiosk-like
- some need multiple products rotating

The template layer is what lets the same retail media system adapt to those differences while still keeping one delivery model underneath.

## 4. Treating Each Screen Like a Page in Practice

One of the clearest ideas the demo is trying to prove is that each installed screen can be treated as a supply endpoint in a way that is analogous to how onsite pages are treated today.

That means:

- a screen has identity
- a screen belongs to a store
- a screen belongs to a logical retail context
- a screen has sellable media share
- a screen can carry one or more line items
- a screen can request creative from a delivery endpoint

The project is effectively saying:

"Do not think of a store screen as a separate signage estate. Think of it as another page-like supply node in the retail media graph."

That is what allows the proposal to fit naturally into current CYield thinking.

## 5. Shared Player Model

The repo deliberately uses one shared player URL:

- `/screen.html`

The idea behind that is also strategic, not just technical convenience.

It shows that:

- the retailer does not need a completely custom player per screen
- the delivery system can resolve which installed screen is calling
- the same rendering path can be reused across many physical placements

In product terms, this matters because it reduces the gap between onsite and in-store delivery:

- onsite already has a standard delivery model
- in-store can move toward a standard player plus supply metadata model

The backend resolves the actual screen using stored device hints and request context, but the higher-level point is simpler:

- one shared player
- many mapped placements
- centrally managed delivery

That is exactly the kind of thing a scalable retail media supply system needs.

## 6. Inventory and Sellable Share

Another important proposal in the repo is that an in-store screen should not be modeled as "all or nothing."

Instead, the screen has configurable share of voice:

- total screen-share slots
- default sellable share
- line-item share allocation

This is a very retail-media-native idea.

It means the retailer can keep part of the screen for:

- retailer messaging
- store operations
- organic merchandising

while still making a defined share of the screen available as monetizable media supply.

This is one of the strongest parts of the proposal because it mirrors onsite realities:

- not every placement is 100% sponsored
- there is usually a balance between owned retail content and paid media inventory

By modeling that explicitly, the repo shows how in-store screens can be sold as media without pretending that the retailer gives up the whole surface.

## 7. Supply Setup in CYield Terms

The supply workflow in the project is intentionally framed to resemble existing CYield behavior.

The proposed operating pattern is:

1. Create a logical page mapping for the retail context.
2. Attach a physical screen to that page.
3. Define the screen's format, cadence, and sellable share.
4. Expose the shared player URL as the delivery surface.
5. Scale that mapping across stores and placements using preset logic rather than manual one-off setup.

What this is trying to prove:

- current onsite-style setup concepts can be extended into store
- the retailer-side operational model remains familiar
- large in-store supply estates can be expressed through standard mappings instead of custom ad hoc configuration

That is why the demo keeps repeating the idea that "screens can be configured in the current platform with minimal modification."

## 8. Buying Model: How Demand Works

The buying side of the repo is framed in CMax terms rather than signage terms.

The proposal is that in-store buying should work like a retail media planning problem:

- choose the advertiser
- choose the goal
- choose the product set or brand focus
- choose scope and flight
- generate a recommended line-up
- fund the selected placements

That is much closer to onsite media buying than to store operations software.

### 8.1 Inputs to buying

The planner works from:

- objective
- advertiser / brand
- optional SKU shortlist
- optional prompt
- store scope
- page scope
- flight dates
- aggressiveness

This is exactly the type of input surface a retail media buyer or account team would expect.

### 8.2 How the planner thinks

The planner combines:

- screen context
- store context
- product relevance
- template suitability
- sellable-share availability
- modeled traffic and commerce signals
- budget constraints

So the output is not "put this asset on these screens." The output is:

- which placements are the best fit
- why they are the best fit
- which screens were excluded and why
- what the expected spend and impression model looks like

That is a proper buying system shape, not a playlist scheduler.

### 8.3 SKU and assortment logic

The repo also proposes that in-store buying can be product-aware in the same way onsite sponsored product systems are.

The planner can:

- take explicit SKU inputs
- infer candidate SKUs from a planning brief
- fall back to brand assortment when needed

This matters because it makes in-store buying feel like retail media rather than generic DOOH:

- the system is tied to retailer assortment
- the creative can be built around real products
- the plan can explain product-to-placement fit

That is much closer to the value Criteo already provides in commerce media.

## 9. Store and Placement Selection Logic

The repo does not simply pick screens at random.

It uses modeled store and placement signals to decide where media should run.

Examples of the kinds of signals used:

- foot traffic
- checkout intent
- premium demand
- clearance pressure
- stock fit
- traffic fit
- placement role fit

At a proposal level, the message is:

- buying in-store media should be more intelligent than "all screens in all stores"
- a retail media system should be able to choose the right store, the right zone, and the right screen for a given commercial objective

That is important because it positions in-store supply as performance-oriented retail media inventory, not just awareness signage.

## 10. Applying the Buy

When a plan is approved, the repo applies it by writing managed line items onto the selected screens.

That is the right abstraction for the proposal.

The buy does not replace the retailer's entire screen setup. Instead it:

- preserves baseline rotation
- injects sponsored share
- attaches campaign identity to the line item
- limits delivery to the selected flight and available share

In other words:

- the retailer continues to own the screen
- the campaign occupies a funded sponsored layer on that screen

That is a much more plausible operating model for retail media than treating the screen as a dedicated ad slot with no retailer control.

## 11. Delivery Model

The delivery endpoint is:

- `GET /api/screen-ad`

Conceptually this is the in-store equivalent of an ad call.

It returns:

- the selected products
- the format
- template settings
- beacon metadata
- contextual settings for the player

The repo rotates through active line items, respects share allocation, and enriches products from the feed.

The product proposal behind that is straightforward:

- store screens should request media from a central delivery layer
- delivery should remain product-aware
- the payload shape should support both standard rendering and resilient fallback rendering

That makes in-store inventory look and behave like real addressable media supply.

## 12. Creative Model

The repo assumes in-store creative is still product-led retail media, but expressed differently depending on placement.

Examples:

- entrance hero
- category hero
- aisle spotlight
- queue-side handoff
- menu-board rotation

The important product idea is not the CSS itself. The important idea is:

- the same advertiser and product inputs can be adapted to different store contexts
- creative can remain standardized enough to scale
- placement-specific behavior is controlled by templates rather than custom one-offs

That is exactly how onsite retail media scales today: common underlying inputs, adapted to different placement types.

## 13. Monitoring Model

The monitoring part of the repo is trying to prove that in-store media can close the loop in a way that is familiar to retail media teams.

It includes three layers:

- what is live
- what was delivered
- what commercial impact is inferred

### 13.1 Live state

The monitoring experience shows:

- which screens are live
- what is currently running on them
- how the creative looks in context

This is the operational equivalent of live placement verification.

### 13.2 Observed delivery

The repo records:

- proof of play
- exposure time

This gives the system an observed delivery layer, which is the minimum credible base for in-store media monitoring.

### 13.3 Modeled commercial outcomes

The repo also adds modeled outputs such as:

- shopper interaction rate
- QR scans
- incremental sales
- new-to-brand sales
- return on spend

These are demo-modeled, not live retailer transaction truth, but the proposal is clear:

- in-store media should not stop at proof of play
- it should be brought into the same commercial measurement conversation as the rest of retail media

That is essential if in-store screens are going to be sold as part of a broader Criteo retail media proposition rather than as digital signage inventory.

## 14. Why This Looks Like Retail Media and Not Signage Software

The repo is deliberately opinionated about the framing.

It is not trying to build:

- a CMS for all store screens
- a general signage scheduler
- a store-ops communications tool

It is trying to show:

- how store screens become monetizable supply
- how that supply can be represented with CYield-like constructs
- how CMax-like buying can activate against it
- how monitoring can report delivery and business impact

That is a very different proposition.

It keeps the center of gravity on:

- monetizable media supply
- advertiser demand
- product-aware targeting
- placement and store selection
- retail outcome measurement

Those are Criteo retail media problems, not generic digital signage problems.

## 15. The Product Story Being Proposed

If this were expressed as a clean product thesis, it would be:

### 15.1 Supply thesis

Physical in-store screens can be onboarded into CYield-like supply using familiar concepts:

- pages
- placements
- formats
- sellable share
- delivery identity

### 15.2 Buying thesis

Those screens can be bought through a retail-media-native workflow:

- choose advertiser and objective
- choose brand or SKUs
- recommend the best store and placement mix
- fund only the selected inventory share

### 15.3 Monitoring thesis

The same system can then monitor:

- what ran
- where it ran
- how long it was seen
- what shopper and commercial outcomes it is expected to drive

### 15.4 Strategic thesis

This extends the current onsite model into store rather than creating a disconnected product category.

That matters because it means:

- retailer-side setup remains legible
- advertiser buying remains legible
- measurement remains legible
- Criteo can position in-store screens as another retail media environment, not as a separate business with a separate operating model

## 16. Bottom Line

The project is best understood as a prototype for a new retail media capability:

- CYield-style supply setup for in-store screens
- CMax-style buying against that supply
- shared delivery through a central player
- monitoring that combines live state, delivery proof, and retail outcome modeling

The most important idea is this:

in-store screens do not need to sit outside the existing retail media model.

They can be treated as another form of page-like, placement-like, product-aware supply inside the same overall system.

That is what this repo is really trying to demonstrate.
