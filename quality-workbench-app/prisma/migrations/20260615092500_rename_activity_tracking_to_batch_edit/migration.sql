UPDATE ComponentConfig
SET name = '批量修改',
    updatedAt = CURRENT_TIMESTAMP
WHERE id = 'cmp-npq-activities'
   OR path = '/flows/npq/activities';
