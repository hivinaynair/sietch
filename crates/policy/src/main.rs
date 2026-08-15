//! Playground. Directory is hardcoded (two demo orgs). You cannot pick a home.

use sietch_policy::{
    evaluate, policy_hash, Book, Delivery, Directory, Policy, Side, CHANI_INSTITUTION,
    PAUL_INSTITUTION,
};

fn parse_book(raw: &str) -> Result<Book, String> {
    match raw {
        "india" => Ok(Book::India),
        "us" => Ok(Book::Us),
        other => Err(format!("book must be india|us, got {other}")),
    }
}

fn parse_side(raw: &str) -> Result<Side, String> {
    match raw {
        "out" => Ok(Side::Outbound),
        "in" => Ok(Side::Inbound),
        other => Err(format!("side must be out|in, got {other}")),
    }
}

fn parse_org(raw: &str) -> Result<sietch_policy::OrgId, String> {
    match raw {
        "chani" => Ok(CHANI_INSTITUTION),
        "paul" => Ok(PAUL_INSTITUTION),
        other => Err(format!("org must be chani|paul, got {other}")),
    }
}

fn parse_flag(raw: &str) -> Result<bool, String> {
    match raw {
        "open" => Ok(true),
        "closed" => Ok(false),
        other => Err(format!("corridor must be open|closed, got {other}")),
    }
}

fn main() {
    let mut args = std::env::args().skip(1);
    let Some(org_raw) = args.next() else {
        eprintln!(
            "usage: sietch-policy <chani|paul> <out|in> <origin:india|us> <amount> <corridor:open|closed>"
        );
        std::process::exit(2);
    };

    let run = (|| {
        let org = parse_org(&org_raw)?;
        let side = parse_side(&args.next().ok_or("missing side")?)?;
        let origin = parse_book(&args.next().ok_or("missing origin")?)?;
        let amount: u64 = args
            .next()
            .ok_or("missing amount")?
            .parse()
            .map_err(|_| "amount must be a number")?;
        let accepts_cross_border = parse_flag(&args.next().ok_or("missing corridor")?)?;
        Ok::<_, String>((org, side, origin, amount, accepts_cross_border))
    })();

    let (org, side, origin, amount, accepts_cross_border) = match run {
        Ok(v) => v,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };

    let directory = Directory::demo();
    let home = directory.home_of(org).expect("demo orgs are in the directory");
    let policy = Policy {
        max_amount: 10,
        accepts_cross_border,
    };
    let delivery = Delivery { amount, origin };
    let allowed = evaluate(&policy, &delivery, side, &directory, org);

    println!("org home (directory, not chosen): {home:?}");
    println!("allowed: {allowed}");
    println!("policy hash: 0x{}", hex::encode(policy_hash(&policy)));
}
