DROP TRIGGER IF EXISTS transactions_notify_gold_transfer_received ON transactions;
DROP FUNCTION IF EXISTS notify_gold_transfer_received();

DELETE FROM notifications WHERE type = 'goldReceived';
