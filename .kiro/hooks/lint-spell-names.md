# Hook: Lint Spell Names

Validates spell names in example JSON files follow kebab-case convention.

## Configuration

```yaml
name: lint-spell-names
trigger: onSave
filePattern: "examples/*.json"
action: agent
prompt: "Check if the spell name in this file follows kebab-case (lowercase letters and hyphens only, 3-50 characters). If not, suggest the correct format."
```

## Purpose

Ensures all example spells follow the naming convention required by SpellSchema. This prevents validation errors when examples are used.

## Benefits

- Consistent naming across examples
- Early detection of invalid names
- Better developer experience
- Matches Zod schema validation
