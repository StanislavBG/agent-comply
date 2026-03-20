function getFieldValue(config, field) {
    // Support dot notation: "models[].human_oversight", "project.owner"
    if (field.startsWith('models[].')) {
        const subfield = field.slice('models[].'.length);
        return config.models.map(m => m[subfield]);
    }
    if (field.startsWith('agents[].')) {
        const subfield = field.slice('agents[].'.length);
        return config.agents.map(a => a[subfield]);
    }
    const parts = field.split('.');
    let val = config;
    for (const part of parts) {
        val = val?.[part];
    }
    return val;
}
function evalCondition(condition, config) {
    const val = getFieldValue(config, condition.field);
    switch (condition.operator) {
        case 'required':
            if (Array.isArray(val))
                return val.every(v => v !== undefined && v !== null && v !== '');
            return val !== undefined && val !== null && val !== '';
        case 'equals':
            if (Array.isArray(val))
                return val.every(v => v === condition.value);
            return val === condition.value;
        case 'not_equals':
            if (Array.isArray(val))
                return val.every(v => v !== condition.value);
            return val !== condition.value;
        case 'in':
            if (!Array.isArray(condition.value))
                return false;
            if (Array.isArray(val))
                return val.every(v => condition.value.includes(v));
            return condition.value.includes(val);
        case 'not_in':
            if (!Array.isArray(condition.value))
                return true;
            if (Array.isArray(val))
                return val.every(v => !condition.value.includes(v));
            return !condition.value.includes(val);
        default:
            return true;
    }
}
export function checkCompliance(config, policy) {
    const violations = [];
    for (const rule of policy.rules) {
        const passes = evalCondition(rule.condition, config);
        if (!passes) {
            violations.push({
                rule_id: rule.id,
                severity: rule.severity,
                description: rule.description,
                context: `field: ${rule.condition.field}, operator: ${rule.condition.operator}${rule.condition.value !== undefined ? `, expected: ${JSON.stringify(rule.condition.value)}` : ''}`,
            });
        }
    }
    return violations;
}
//# sourceMappingURL=index.js.map