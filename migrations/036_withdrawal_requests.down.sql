DROP TRIGGER IF EXISTS withdrawal_requests_notify_reviewed ON withdrawal_requests;
DROP TRIGGER IF EXISTS withdrawal_requests_notify_submitted ON withdrawal_requests;
DROP TRIGGER IF EXISTS withdrawal_requests_notify_live ON withdrawal_requests;
DROP FUNCTION IF EXISTS notify_withdrawal_request_reviewed();
DROP FUNCTION IF EXISTS notify_withdrawal_request_submitted();

WITH refunds AS (
    SELECT requester_id, guild_id, SUM(amount) AS amount
    FROM withdrawal_requests
    WHERE status = 'pending'
    GROUP BY requester_id, guild_id
)
UPDATE wallets w SET balance = w.balance + r.amount, updated_at = NOW()
FROM refunds r
WHERE w.user_id = r.requester_id AND w.guild_id = r.guild_id;

INSERT INTO transactions (user_id, guild_id, type, amount, balance_after, reference_id, reference_type)
SELECT wr.requester_id, wr.guild_id, 'WITHDRAWAL_CANCELLED', wr.amount, w.balance, wr.id, 'withdrawal'
FROM withdrawal_requests wr
JOIN wallets w ON w.user_id = wr.requester_id AND w.guild_id = wr.guild_id
WHERE wr.status = 'pending';

DELETE FROM notifications
WHERE type IN ('withdrawalRequestSubmitted', 'withdrawalRequestApproved', 'withdrawalRequestRejected');

DROP TABLE IF EXISTS withdrawal_requests;
