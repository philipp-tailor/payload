# Relationship Field-Level Populate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `populate` configuration to relationship fields for field-level control over which fields are selected during population.

**Architecture:** Add optional `populate?: SelectType` to relationship field type definitions, update relationship population logic to check field-level populate before falling back to collection defaultPopulate, maintain query-level override capability.

**Tech Stack:** TypeScript, Vitest, Payload CMS core

**References:**

- Design doc: `docs/plans/2025-12-24-relationship-field-populate-design.md`
- Type definitions: `packages/payload/src/types/index.ts` (SelectType)
- Population logic: `packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts`

---

## Task 1: Add Type Definition for Field-Level Populate

**Files:**

- Modify: `packages/payload/src/fields/config/types.ts:1178-1200` (SharedRelationshipProperties)

**Step 1: Read the current type definition**

Read `packages/payload/src/fields/config/types.ts` to locate `SharedRelationshipProperties` type (around line 1178).

**Step 2: Add populate property to SharedRelationshipProperties**

Add the `populate` property after `maxDepth`:

```typescript
type SharedRelationshipProperties = {
  filterOptions?: FilterOptions
  maxDepth?: number
  populate?: SelectType // ← ADD THIS LINE
  type: 'relationship'
} & (
  | {
      hasMany: true
      max?: number
      maxRows?: number
      min?: number
      minRows?: number
      validate?: RelationshipFieldManyValidation
    }
  | {
      hasMany?: false | undefined
      max?: never
      maxRows?: never
      min?: never
      minRows?: never
      validate?: RelationshipFieldSingleValidation
    }
) &
  FieldGraphQLType &
  Omit<FieldBase, 'validate'>
```

**Step 3: Verify SelectType import exists**

Check that `SelectType` is imported. Look for:

```typescript
import type { SelectType } from '../../types/index.js'
```

If not present, add it to the imports at the top of the file.

**Step 4: Build the types package**

Run: `pnpm run build:payload`
Expected: Build succeeds with no type errors

**Step 5: Commit the type definition**

```bash
git add packages/payload/src/fields/config/types.ts
git commit -m "feat(payload): add populate property to relationship field type"
```

---

## Task 2: Update Relationship Population Logic

**Files:**

- Modify: `packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts:76-94`

**Step 1: Read the current population logic**

Read `packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts` and locate the `select` assignment (around lines 88-90).

Current code:

```typescript
select:
  populateArg?.[relatedCollection.config.slug] ??
  relatedCollection.config.defaultPopulate,
```

**Step 2: Add field-level populate to the resolution chain**

Update the select resolution to check for field-level populate:

```typescript
select:
  populateArg?.[relatedCollection.config.slug] ??
  ('populate' in field && field.populate) ??
  relatedCollection.config.defaultPopulate,
```

Note: We use `'populate' in field && field.populate` because `field` is a union type and TypeScript needs the type guard.

**Step 3: Build the payload package**

Run: `pnpm run build:payload`
Expected: Build succeeds with no type errors

**Step 4: Commit the population logic update**

```bash
git add packages/payload/src/fields/hooks/afterRead/relationshipPopulationPromise.ts
git commit -m "feat(payload): use field-level populate in relationship population"
```

---

## Task 3: Create Test Collection with Field-Level Populate

**Files:**

- Create: `test/fields-relationship/collections/RelationWithPopulate.ts`
- Modify: `test/fields-relationship/config.ts` (add new collection)

**Step 1: Create collection with field-level populate**

Create `test/fields-relationship/collections/RelationWithPopulate.ts`:

```typescript
import type { CollectionConfig } from 'payload'

export const RelationWithPopulate: CollectionConfig = {
  slug: 'relation-with-populate',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'relationDefault',
      type: 'relationship',
      relationTo: 'relation-a',
      // No populate - should use collection defaultPopulate
    },
    {
      name: 'relationWithPopulate',
      type: 'relationship',
      relationTo: 'relation-a',
      populate: {
        title: true,
        number: true,
      },
    },
    {
      name: 'relationPolymorphic',
      type: 'relationship',
      relationTo: ['relation-a', 'relation-b'],
      populate: {
        title: true,
      },
    },
  ],
}
```

**Step 2: Add collection to test config**

Read `test/fields-relationship/config.ts` and add the new collection to the collections array:

```typescript
import { RelationWithPopulate } from './collections/RelationWithPopulate.js'

export default buildConfigWithDefaults({
  collections: [
    // ... existing collections
    RelationWithPopulate,
  ],
  // ... rest of config
})
```

**Step 3: Build test config**

Run: `pnpm run build:payload`
Expected: Build succeeds

**Step 4: Commit test collection**

```bash
git add test/fields-relationship/collections/RelationWithPopulate.ts test/fields-relationship/config.ts
git commit -m "test(fields-relationship): add collection with field-level populate"
```

---

## Task 4: Write Test - Field-Level Populate Applies

**Files:**

- Modify: `test/fields-relationship/int.spec.ts`

**Step 1: Add test case for field-level populate**

Add a new `describe` block in `test/fields-relationship/int.spec.ts`:

```typescript
describe('Field-level populate', () => {
  let docWithRelations: any
  let relatedDocA: any

  beforeAll(async () => {
    // Create a related document
    relatedDocA = await payload.create({
      collection: 'relation-a',
      data: {
        title: 'Related A Title',
        number: 42,
        richText: [
          {
            children: [{ text: 'Rich text content' }],
          },
        ],
      },
    })

    // Create document with relationships
    docWithRelations = await payload.create({
      collection: 'relation-with-populate',
      data: {
        title: 'Main Doc',
        description: 'Test doc',
        relationWithPopulate: relatedDocA.id,
      },
    })
  })

  it('should use field-level populate when configured', async () => {
    const doc = await payload.findByID({
      collection: 'relation-with-populate',
      id: docWithRelations.id,
      depth: 1,
    })

    expect(doc.relationWithPopulate).toBeDefined()
    expect(typeof doc.relationWithPopulate).toBe('object')

    const populated = doc.relationWithPopulate

    // Should have fields specified in populate
    expect(populated.title).toBe('Related A Title')
    expect(populated.number).toBe(42)

    // Should NOT have fields not in populate
    expect(populated.richText).toBeUndefined()
  })
})
```

**Step 2: Run the test to verify it fails**

Run: `pnpm run test:int fields-relationship`
Expected: Test should FAIL because field-level populate isn't implemented yet

**Step 3: Verify implementation works**

Since we already implemented the logic in Task 2, run the test again:

Run: `pnpm run test:int fields-relationship`
Expected: Test should PASS

**Step 4: Commit the test**

```bash
git add test/fields-relationship/int.spec.ts
git commit -m "test(fields-relationship): add test for field-level populate"
```

---

## Task 5: Write Test - Field-Level Overrides Collection defaultPopulate

**Files:**

- Modify: `test/fields-relationship/collections/RelationA.ts` (add defaultPopulate if not present)
- Modify: `test/fields-relationship/int.spec.ts`

**Step 1: Verify RelationA has defaultPopulate**

Read `test/fields-relationship/collections/RelationA.ts` and check if it has `defaultPopulate` configured. If not, add it:

```typescript
export const RelationA: CollectionConfig = {
  slug: 'relation-a',
  defaultPopulate: {
    title: true,
    richText: true,
    // Excludes 'number'
  },
  fields: [
    // ... existing fields
  ],
}
```

**Step 2: Add test for override behavior**

Add test case to the 'Field-level populate' describe block:

```typescript
it('should override collection defaultPopulate', async () => {
  // RelationA has defaultPopulate: { title: true, richText: true }
  // But field has populate: { title: true, number: true }

  const doc = await payload.findByID({
    collection: 'relation-with-populate',
    id: docWithRelations.id,
    depth: 1,
  })

  const populated = doc.relationWithPopulate

  // Should have field-level populate fields
  expect(populated.title).toBe('Related A Title')
  expect(populated.number).toBe(42)

  // Should NOT have defaultPopulate fields that aren't in field populate
  expect(populated.richText).toBeUndefined()
})
```

**Step 3: Run the test**

Run: `pnpm run test:int fields-relationship`
Expected: Test should PASS (verifying override behavior works)

**Step 4: Commit**

```bash
git add test/fields-relationship/collections/RelationA.ts test/fields-relationship/int.spec.ts
git commit -m "test(fields-relationship): verify field populate overrides defaultPopulate"
```

---

## Task 6: Write Test - Query-Level Populate Overrides Field-Level

**Files:**

- Modify: `test/fields-relationship/int.spec.ts`

**Step 1: Add test for query-level override**

Add test case to the 'Field-level populate' describe block:

```typescript
it('should allow query-level populate to override field-level', async () => {
  // Field has populate: { title: true, number: true }
  // Query specifies different populate

  const doc = await payload.findByID({
    collection: 'relation-with-populate',
    id: docWithRelations.id,
    depth: 1,
    populate: {
      'relation-a': {
        title: true,
        richText: true,
        // Excludes 'number' that field-level includes
      },
    },
  })

  const populated = doc.relationWithPopulate

  // Should have query-level populate fields
  expect(populated.title).toBe('Related A Title')
  expect(populated.richText).toBeDefined()

  // Should NOT have field-level populate fields excluded by query
  expect(populated.number).toBeUndefined()
})
```

**Step 2: Run the test**

Run: `pnpm run test:int fields-relationship`
Expected: Test should PASS (verifying query-level takes precedence)

**Step 3: Commit**

```bash
git add test/fields-relationship/int.spec.ts
git commit -m "test(fields-relationship): verify query populate overrides field populate"
```

---

## Task 7: Write Test - Polymorphic Relationships Use Same Populate

**Files:**

- Modify: `test/fields-relationship/int.spec.ts`

**Step 1: Create test data for polymorphic relationships**

Add setup in the `beforeAll` of 'Field-level populate' describe block:

```typescript
let relatedDocB: any

beforeAll(async () => {
  // ... existing setup

  // Create relation-b document
  relatedDocB = await payload.create({
    collection: 'relation-b',
    data: {
      title: 'Related B Title',
      // other fields...
    },
  })

  // Update doc with polymorphic relations
  docWithRelations = await payload.update({
    collection: 'relation-with-populate',
    id: docWithRelations.id,
    data: {
      relationPolymorphic: [
        { relationTo: 'relation-a', value: relatedDocA.id },
        { relationTo: 'relation-b', value: relatedDocB.id },
      ],
    },
  })
})
```

**Step 2: Add test for polymorphic populate**

Add test case:

```typescript
it('should apply same populate to all collections in polymorphic relationship', async () => {
  const doc = await payload.findByID({
    collection: 'relation-with-populate',
    id: docWithRelations.id,
    depth: 1,
  })

  expect(Array.isArray(doc.relationPolymorphic)).toBe(true)
  expect(doc.relationPolymorphic).toHaveLength(2)

  // Both populated docs should have title (from field populate)
  const populatedA = doc.relationPolymorphic.find(
    (r) => r.relationTo === 'relation-a',
  )
  const populatedB = doc.relationPolymorphic.find(
    (r) => r.relationTo === 'relation-b',
  )

  expect(populatedA.value.title).toBe('Related A Title')
  expect(populatedB.value.title).toBe('Related B Title')

  // Should not have other fields (field only specifies title)
  expect(populatedA.value.number).toBeUndefined()
})
```

**Step 3: Run the test**

Run: `pnpm run test:int fields-relationship`
Expected: Test should PASS

**Step 4: Commit**

```bash
git add test/fields-relationship/int.spec.ts
git commit -m "test(fields-relationship): verify polymorphic relations use same populate"
```

---

## Task 8: Write Test - Field Without Populate Uses Default

**Files:**

- Modify: `test/fields-relationship/int.spec.ts`

**Step 1: Add test for backward compatibility**

Add test case to verify fields without `populate` still work:

```typescript
it('should use collection defaultPopulate when field has no populate config', async () => {
  // Create doc with relationDefault (no field-level populate)
  const doc = await payload.create({
    collection: 'relation-with-populate',
    data: {
      title: 'Default Test',
      relationDefault: relatedDocA.id,
    },
  })

  const fetched = await payload.findByID({
    collection: 'relation-with-populate',
    id: doc.id,
    depth: 1,
  })

  const populated = fetched.relationDefault

  // Should use collection defaultPopulate (title + richText)
  expect(populated.title).toBe('Related A Title')
  expect(populated.richText).toBeDefined()
  // number not in defaultPopulate
  expect(populated.number).toBeUndefined()
})
```

**Step 2: Run the test**

Run: `pnpm run test:int fields-relationship`
Expected: Test should PASS (verifying backward compatibility)

**Step 3: Commit**

```bash
git add test/fields-relationship/int.spec.ts
git commit -m "test(fields-relationship): verify backward compatibility without populate"
```

---

## Task 9: Run Full Test Suite

**Step 1: Run all relationship field tests**

Run: `pnpm run test:int fields-relationship`
Expected: All tests PASS

**Step 2: Run broader integration tests**

Run: `pnpm run test:int`
Expected: All integration tests PASS (verify no regressions)

**Step 3: Build all packages**

Run: `pnpm run build:core`
Expected: Build succeeds with no errors

**Step 4: If any tests fail, debug and fix**

If tests fail:

- Read the test output carefully
- Check the modified files
- Verify the logic matches the design
- Fix issues and re-run tests
- Commit fixes with descriptive messages

---

## Task 10: Update Documentation

**Files:**

- Modify: `docs/fields/relationship.mdx`

**Step 1: Read existing relationship field documentation**

Read `docs/fields/relationship.mdx` to understand the current structure and find where to add the new section.

**Step 2: Add Field-Level Populate section**

Add a new section after the existing configuration sections (look for sections on `filterOptions`, `maxDepth`, etc.):

````mdx
## Field-Level Populate

By default, when Payload populates relationship fields, it uses the related collection's `defaultPopulate` configuration. You can override this on a per-field basis using the `populate` property.

This is useful when:

- You need specific fields for virtual field calculations
- Different relationship fields need different data from the same collection
- You want to optimize what's fetched for specific relationships

### Basic Example

<Code>
```ts
{
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
  populate: {
    name: true,
    email: true,
    avatar: true,
  },
}
````

</Code>

When this relationship is populated (either in API responses or the admin UI picker), only the specified fields (`name`, `email`, `avatar`) will be included.

### Populate Priority

When populating relationships, Payload follows this priority hierarchy:

1. **Query-level populate** (highest) - Explicit `populate` argument in queries
2. **Field-level populate** (middle) - The `populate` config on the field
3. **Collection defaultPopulate** (lowest) - The collection's default

#### Example

<Code>
```ts
// Collection config
{
  slug: 'users',
  defaultPopulate: {
    id: true,
    name: true,
  },
}

// Field config
{
name: 'author',
type: 'relationship',
relationTo: 'users',
populate: {
name: true,
email: true,
avatar: true,
},
}

// Query with override
await payload.find({
collection: 'posts',
populate: {
users: {
name: true,
bio: true,
},
},
})
// Result: author will have { name, bio } (query-level wins)

````
</Code>

### Polymorphic Relationships

For polymorphic relationships (multiple `relationTo` collections), the same `populate` configuration applies to all collections:

<Code>
```ts
{
  name: 'relatedContent',
  type: 'relationship',
  relationTo: ['posts', 'pages'],
  populate: {
    title: true,
    slug: true,
  },
  // Both posts AND pages will use this populate
}
````

</Code>

To use different selects per collection, use query-level populate instead.

### TypeScript

The `populate` property is typed as `SelectType`. See the [Select Query Documentation](/docs/queries/select) for details on the select syntax, including nested field selection.

````

**Step 3: Build documentation**

Run: `pnpm run build` (or check if docs have a specific build command)
Expected: Documentation builds successfully

**Step 4: Commit documentation**

```bash
git add docs/fields/relationship.mdx
git commit -m "docs(fields): add field-level populate documentation for relationship fields"
````

---

## Task 11: Generate Types and Verify

**Step 1: Generate types for test directory**

Run: `pnpm run dev:generate-types fields-relationship`
Expected: Types generated successfully

**Step 2: Verify type exports**

Check that `RelationWithPopulate` type was generated and includes the populate property in the field definitions.

**Step 3: Build all packages one final time**

Run: `pnpm run build:core`
Expected: Clean build with no errors

**Step 4: Run linter**

Run: `pnpm run lint`
Expected: No linting errors

If there are auto-fixable issues:
Run: `pnpm run lint:fix`

**Step 5: Final test run**

Run: `pnpm run test:int fields-relationship`
Expected: All tests PASS

---

## Task 12: Final Review and Summary Commit

**Step 1: Review all changes**

Run: `git log --oneline origin/main..HEAD`
Review commit history to ensure all changes are properly committed

**Step 2: Check git status**

Run: `git status`
Expected: Working tree clean (no uncommitted changes)

**Step 3: Review the design document**

Read `docs/plans/2025-12-24-relationship-field-populate-design.md` and verify implementation matches the design.

**Step 4: Create summary of implementation**

Document what was implemented:

- Added `populate?: SelectType` to relationship field type
- Updated population logic to check field-level populate
- Added comprehensive tests covering all scenarios
- Updated documentation

---

## Completion Checklist

- [ ] Type definition added to SharedRelationshipProperties
- [ ] Population logic updated in relationshipPopulationPromise
- [ ] Test collection created with field-level populate examples
- [ ] Test: Field-level populate applies
- [ ] Test: Field-level overrides defaultPopulate
- [ ] Test: Query-level overrides field-level
- [ ] Test: Polymorphic relationships work
- [ ] Test: Backward compatibility (no populate config)
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Types generated
- [ ] Linting passes
- [ ] All changes committed

---

## Notes

**Testing Philosophy:**

- Write tests that fail first, then implement
- Test the happy path and edge cases
- Verify backward compatibility

**Commit Strategy:**

- Small, focused commits
- Clear commit messages following conventional commits
- Commit after each completed task

**If Something Goes Wrong:**

- Read error messages carefully
- Check the design document for clarification
- Verify type definitions match expected structure
- Run tests in isolation to identify issues
