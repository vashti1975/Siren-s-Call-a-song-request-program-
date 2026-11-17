CREATE TABLE `listener_reward_purchases` (
	`user_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`cost` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `reward_id`)
);
