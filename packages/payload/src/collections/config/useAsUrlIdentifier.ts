import type { CollectionConfig } from '../../index.js'

import { InvalidConfiguration } from '../../errors/InvalidConfiguration.js'
import { fieldAffectsData } from '../../fields/config/types.js'
import { flattenTopLevelFields } from '../../utilities/flattenTopLevelFields.js'

/**
 * Validate useAsUrlIdentifier for collections.
 */
export const validateUseAsUrlIdentifier = (config: CollectionConfig) => {
  const identifierFieldName = config.admin?.useAsUrlIdentifier

  // Skip validation if using default 'id' field
  if (!identifierFieldName || identifierFieldName === 'id') {
    return
  }

  // Check for nested field paths
  if (identifierFieldName.includes('.')) {
    throw new InvalidConfiguration(
      `"useAsUrlIdentifier" cannot be a nested field. Please specify a top-level field in the collection "${config.slug}"`,
    )
  }

  const fields = flattenTopLevelFields(config.fields)
  const identifierField = fields.find((field) => {
    if (fieldAffectsData(field)) {
      return field.name === identifierFieldName
    }
    return false
  })

  // Check field exists
  if (!identifierField) {
    throw new InvalidConfiguration(
      `The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" does not exist in the collection "${config.slug}"`,
    )
  }

  // Check field is not virtual
  if ('virtual' in identifierField && identifierField.virtual === true) {
    throw new InvalidConfiguration(
      `The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" in the collection "${config.slug}" is virtual. A virtual field cannot be used as a URL identifier.`,
    )
  }

  // Check field type is text or number
  if (identifierField.type !== 'text' && identifierField.type !== 'number') {
    throw new InvalidConfiguration(
      `The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" in the collection "${config.slug}" must be of type "text" or "number". Found type "${identifierField.type}".`,
    )
  }

  // Check field is not a relationship
  if (identifierField.type === 'relationship' || identifierField.type === 'upload') {
    throw new InvalidConfiguration(
      `The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" in the collection "${config.slug}" cannot be a relationship field.`,
    )
  }

  // Check field is unique
  if (!('unique' in identifierField) || identifierField.unique !== true) {
    throw new InvalidConfiguration(
      `The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" in the collection "${config.slug}" must have "unique: true" to be used as a URL identifier.`,
    )
  }

  // Warn if field is not indexed (performance recommendation)
  if (!('index' in identifierField) || identifierField.index !== true) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Payload] Warning: The field "${identifierFieldName}" specified in "admin.useAsUrlIdentifier" in the collection "${config.slug}" does not have "index: true". For better performance, consider adding an index to this field.`,
    )
  }
}
