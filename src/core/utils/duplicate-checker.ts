export function buildDuplicateConditions(data: Partial<Record<string, any>>, fields: string[]): { [key: string]: any }[] {
    return fields
        .filter(field => data[field] !== undefined && data[field] !== null && data[field] !== '')
        .map(field => ({ [field]: data[field] }));
}