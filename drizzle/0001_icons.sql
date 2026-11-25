-- Emoji -> Material Community Icons for built-in categories and wallets (DESIGN.md).
-- Only rows still on their original emoji change; updated_at is kept so this never wins a sync over a real edit.
UPDATE categories SET icon = 'silverware-fork-knife', color = '#A8392D' WHERE id = 'default-expense-food' AND icon = '🍜';--> statement-breakpoint
UPDATE categories SET icon = 'motorbike', color = '#2E6E8E' WHERE id = 'default-expense-transport' AND icon = '🛵';--> statement-breakpoint
UPDATE categories SET icon = 'receipt-text', color = '#8A5A00' WHERE id = 'default-expense-bills' AND icon = '💡';--> statement-breakpoint
UPDATE categories SET icon = 'cart', color = '#8E3B5E' WHERE id = 'default-expense-shopping' AND icon = '🛒';--> statement-breakpoint
UPDATE categories SET icon = 'movie-open', color = '#5B4B9A' WHERE id = 'default-expense-fun' AND icon = '🎬';--> statement-breakpoint
UPDATE categories SET icon = 'medical-bag', color = '#1F4D3A' WHERE id = 'default-expense-health' AND icon = '💊';--> statement-breakpoint
UPDATE categories SET icon = 'school', color = '#3D5A80' WHERE id = 'default-expense-edu' AND icon = '📚';--> statement-breakpoint
UPDATE categories SET icon = 'dots-horizontal-circle', color = '#56665C' WHERE id IN ('default-expense-other', 'default-income-other') AND icon = '📦';--> statement-breakpoint
UPDATE categories SET icon = 'briefcase', color = '#1F4D3A' WHERE id = 'default-income-salary' AND icon = '💼';--> statement-breakpoint
UPDATE categories SET icon = 'gift', color = '#8A5A00' WHERE id = 'default-income-bonus' AND icon = '🎁';--> statement-breakpoint
UPDATE wallets SET icon = 'cash' WHERE type = 'cash' AND icon = '💵';--> statement-breakpoint
UPDATE wallets SET icon = 'bank' WHERE type = 'bank' AND icon = '🏦';--> statement-breakpoint
UPDATE wallets SET icon = 'cellphone' WHERE type = 'ewallet' AND icon = '📱';
