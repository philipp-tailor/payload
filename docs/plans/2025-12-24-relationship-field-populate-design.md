# Relationship Field-Level Populate Configuration

**Date:** 2025-12-24
**Status:** Approved Design
**Branch:** `allow-configure-select-for-relationship-fields`

## Overview

Add a `populate` configuration option to relationship fields that allows specifying which fields should be selected when the relationship is populated. This provides field-level control over what data is fetched, enabling use cases like virtual fields with `afterRead` hooks.

## Use Case

When relationship fields are populated, they currently use the related collection's `defaultPopulate` configuration. This design adds per-field control, which is particularly useful for:

1. **Virtual fields** - Selecting source fields needed for `afterRead` hooks to compute derived values
2. **Performance** - Optimizing what's fetched for specific relationship contexts
3. **Field-specific needs** - Different relationship fields needing different data from the same collection

### Example Flow

```typescript
// Related collection with virtual field
{
  slug: 'sources',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'text' },
    {
      name: 'displayName',  // Virtual field
      type: 'text',
      hooks: {
        afterRead: [({ data }) => `${data.title} - ${data.description}`]
      }
    }
  ]
}

// Relationship field with populate
{
  name: 'sources',
  type: 'relationship',
  relationTo: 'sources',
  populate: {
    title: true,
    description: true,
    displayName: true  // Virtual field included
  }
}

// When populated, all three fields are available (including computed displayName)
// This works in both API responses and the admin UI relationship picker
```

## Design Decisions

### 1. Naming: `populate` vs `select`

**Decision:** Use `populate` (not `select`)

**Rationale:**

- Matches existing query API naming conventions
- Semantically aligns with `defaultPopulate` at collection level
- Avoids confusion between `select` (query operation) and field configuration

### 2. Location: Top-level vs Nested

**Decision:** Top-level field property

**Alternatives considered:**

- Under `admin` config - Rejected because populate affects API responses, not just admin UI
- Separate UI and API config - Rejected as unnecessarily complex for most use cases

**Rationale:**

- Simple and clear
- Matches semantic level (affects data population, not just UI)
- Similar to other field-level query customizations like `maxDepth`

### 3. Override Behavior

**Decision:** Replace semantics with query-level override support

**Priority hierarchy:**

```
1. Query-level populate (highest)    - Explicit override in queries
2. Field-level populate (middle)     - This feature
3. Collection defaultPopulate (lowest) - Collection default
```

**Rationale:**

- Clean and predictable behavior
- Matches how query-level `populate` currently overrides `defaultPopulate`
- Developers explicitly include desired fields (no magic merging)

### 4. Polymorphic Relationships

**Decision:** Single `populate` applies to all `relationTo` collections

**Example:**

```typescript
{
  name: 'relatedContent',
  relationTo: ['posts', 'pages'],
  populate: { title: true, slug: true }
  // Same select for both posts AND pages
}
```

**Rationale:**

- Simpler implementation and API
- Covers most common use cases
- Query-level populate can still provide per-collection overrides when needed

**Future enhancement:** Could add per-collection populate if needed:

```typescript
populate: {
  posts: { title: true, content: true },
  pages: { title: true, slug: true }
}
```

## Implementation

### 1. Type System Changes

**File:** `packages/payload/src/fields/config/types.ts`

Add `populate` property to `SharedRelationshipProperties`:

```typescript
import type { SelectType } from '../../types/index.js'

type SharedRelationshipProperties = {
  filterOptions?: FilterOptions
  maxDepth?: number
  populate?: SelectType  // ← NEW
  type: 'relationship'
} & (/* hasMany variants */) & FieldGraphQLType & Omit<FieldBase, 'validate'>
```

**Details:**

- Type: `SelectType` (same as collection `defaultPopulate`)
- Optional property (fully backward compatible)
- Applies to both `SingleRelationshipField` and `PolymorphicRelationshipField`

### 2. Population Logic Changes

**File:** `packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts`

Update the select resolution logic:

**Current (lines 88-90):**

```typescript
select:
  populateArg?.[relatedCollection.config.slug] ??
  relatedCollection.config.defaultPopulate,
```

**Updated:**

```typescript
const fieldPopulate = 'populate' in field ? field.populate : undefined

select:
  populateArg?.[relatedCollection.config.slug] ??  // Query-level (highest)
  fieldPopulate ??                                  // Field-level (NEW)
  relatedCollection.config.defaultPopulate,        // Collection-level (lowest)
```

**Impact:**

- Affects all find operations
- Affects all findByID operations
- Affects admin UI relationship picker queries
- Affects any custom queries that populate relationships

### 3. Testing Strategy

**Location:** `test/fields-relationship/`

**Test Collections:**

```typescript
// posts-with-populate collection
{
  slug: 'posts-with-populate',
  fields: [
    {
      name: 'relatedPost',
      type: 'relationship',
      relationTo: 'posts',
      populate: {
        title: true,
        description: true,
        virtualField: true
      }
    },
    {
      name: 'polymorphicRelation',
      type: 'relationship',
      relationTo: ['posts', 'pages'],
      populate: {
        title: true,
        slug: true
      }
    }
  ]
}
```

**Integration Test Cases** (`int.spec.ts`):

1. Field-level populate is applied
2. Field-level overrides collection defaultPopulate
3. Query-level populate overrides field-level
4. Polymorphic relationships use same populate for all collections
5. Virtual fields work with populate
6. UI picker respects populate (optional)

**E2E Tests** (`e2e.spec.ts` - optional):

- Verify relationship picker fetches configured fields
- Verify virtual fields display correctly in picker

### 4. Documentation

**File:** `docs/fields/relationship.mdx`

Add new section "Field-Level Populate" covering:

- What it does and when to use it
- Code examples
- Priority hierarchy explanation
- Polymorphic relationship behavior
- Link to Select Query documentation

**Additional updates:**

- Update TypeScript types reference
- Add to relationship field API reference table

## Technical Notes

### Backward Compatibility

- Fully backward compatible (optional property)
- Existing relationship fields work unchanged
- No migration needed

### Performance Considerations

- Field-level populate applies to both API and UI contexts
- UI picker queries will fetch configured fields (previously only fetched `useAsTitle`)
- This is intentional - allows virtual fields to work in UI
- Developers should be mindful of selecting only needed fields

### Type Safety

- `populate` is typed as `SelectType`
- Works with TypeScript collection types
- Type checking ensures valid field names (when using generated types)

### GraphQL Considerations

- Should work automatically with GraphQL API
- GraphQL queries can still override with their own field selections
- No special handling needed

## Open Questions

None - design approved.

## References

- Current implementation: `packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts`
- Type definitions: `packages/payload/src/fields/config/types.ts`
- Select types: `packages/payload/src/types/index.ts`
- Documentation: `docs/queries/select.mdx`
