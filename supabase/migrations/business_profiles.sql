-- KYB / TCPA attestation captured before a user can buy or claim a phone
-- number. Required for telecom compliance (A2P 10DLC brand registration,
-- carrier audit trail) and to shift TCPA liability onto the user.
create table if not exists user_business_profiles (
  user_id uuid primary key references users(id) on delete cascade,

  -- Business identity
  legal_name text not null,
  ein text,                      -- nullable: sole props may not have one
  business_type text,            -- "llc", "corp", "sole_prop", "nonprofit", "other"
  website text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text not null,          -- state / province
  postal_code text not null,
  country text not null default 'US',

  -- Authorized representative
  rep_name text not null,
  rep_email text not null,
  rep_title text,
  rep_phone text,

  -- Use case (carriers ask for this)
  use_case text not null,        -- free-form description of how the user will use the number

  -- TCPA / terms attestation — legally meaningful
  tcpa_attested boolean not null default false,
  attested_at timestamptz,
  attested_ip text,
  attested_user_agent text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_business_profiles_attested_idx
  on user_business_profiles (tcpa_attested, attested_at);
