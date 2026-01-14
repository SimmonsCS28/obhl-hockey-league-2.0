import csv

# Read CSV file and extract emails
csv_emails = set()
csv_email_to_name = {}

with open('CustomRegistrationReport -  Admin (2).csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)  # Skip header
    for row in reader:
        if len(row) >= 6:
            email = row[5].strip().lower()  # Email is column 6 (index 5)
            first_name = row[3].strip()
            last_name = row[4].strip()
            csv_emails.add(email)
            csv_email_to_name[email] = f"{first_name} {last_name}"

# Production emails (from the query output)
prod_emails = set([
    "andersjoel@gmail.com",
    "nandriacchi@hotmail.com",
    "darvold88@gmail.com",
    "ausmanella@gmail.com",
    "zbarnetzke@gmail.com",
    "hockeyphil65@gmail.com",
    "tbehnks11@yahoo.com",
    "A_bernath@hotmail.com",
    "pmbormann@hotmail.com",
    "gembotts@gmail.com",
    "bbouche@findorff.com",
    "cjbruns10910@gmail.com",
    "coobacmz@me.com",
    "brianacronk@gmail.com",
    "chrsculver@gmail.com",
    "cougartreasurer2019@gmail.com",
    "casdabbs34@gmail.com",
    "rogermdarling@gmail.com",
    "gbradleydavenport@gmail.com",
    "stefandavidson14@gmail.com",
    "dadman0901@gmail.com",
    "mdunk@chorus.net",
    "jamesertel04@gmail.com",
    "jfriedle96@gmail.com",
    "zfyler1@gmail.com",
    "tonygackstetter@gmail.com",
    "Toby.garrod24@gmail.com",
    "dbgauder@yahoo.com",
    "geiger_brian@rocketmail.com",
    "mag1_46@hotmail.com",
    "thecodster@gmail.com",
    "josephbgoldfine@gmail.com",
    "hockeybob64@gmail.com",
    "jjgrailer@gmail.com",
    "trevor.greissinger@gmail.com",
    "tjhaglind@mac.com",
    "emmettherr@gmail.com",
    "gagehill0717@gmail.com",
    "hlinkam@yahoo.com",
    "ishimurazero@gmail.com",
    "alexhohlstein@yahoo.com",
    "gteeiguy@yahoo.com",
    "cjduli@yahoo.com",
    "josephjohnsiv@gmail.com",
    "kachan.victor@gmail.com",
    "karstenrob@yahoo.com",
    "Jasonkent24@yahoo.com",
    "spfdklahn@gmail.com",
    "klaus839@yahoo.com",
    "lilkoltes@gmail.com",
    "krehwen@gmail.com",
    "kball2297@gmail.com",
    "stevenlascola@gmail.com",
    "m_labron@hotmail.com",
    "lavignejr15@gmail.com",
    "chrislewis8843@gmail.com",
    "gm_lind@yahoo.com",
    "jtlind@gmail.com",
    "bloken21@gmail.com",
    "jrl9215@gmail.com",
    "nikolastreecare@gmail.com",
    "winn.lyons94@gmail.com",
    "jedimalkovich@gmail.com",
    "tmrshll1@gmail.com",
    "bnnitram@yahoo.com",
    "tophermartin55@gmail.com",
    "mamyay@hotmail.com",
    "kevin.mcconnaughay@gmail.com",
    "chargerhemi06@yahoo.com",
    "cmicon@gmail.com",
    "mcmuzzcm@icloud.com",
    "ryanolstad44@gmail.com",
    "johndoconnell5@gmail.com",
    "parker.dere@gmail.com",
    "pedracine_phillip@hotmail.com",
    "corylyle@gmail.com",
    "hpflieger@yahoo.com",
    "bryantimothypierce@gmail.com",
    "pod526@hotmail.com",
    "mralph1009@gmail.com",
    "mralph@live.com",
    "robinson.peter.c@gmail.com",
    "yzzi19@msn.com",
    "jon_rogers@trekbikes.com",
    "jsruesch@gmail.com",
    "mruff12@gmail.com",
    "tannermschafer@gmail.com",
    "andythearborist@gmail.com",
    "purpleice25@yahoo.com",
    "jjrschneid@gmail.com",
    "bryanschreiter@yahoo.com",
    "brockwschupp@gmail.com",
    "mattjseverson@gmail.com",
    "thunder56082@yahoo.com",
    "simmonscs28@gmail.com",
    "hsotsai@gmail.com",
    "jakestamas@gmail.com",
    "ntstapelfeldt@gmail.com",
    "stein.osu.293@gmail.com",
    "austinsteinbach@gmail.com",
    "kylejsteinberg@gmail.com",
    "jarsteinbergs@proton.me",
    "bstephenson014@gmail.com",
    "kstephenson93@gmail.com",
    "sotnar@gmail.com",
    "alexandersuchon@gmail.com",
    "sullivanrp2@gmail.com",
    "ryanhavilandsullivan3@gmail.com",
    "btempleton123@gmail.com",
    "thornton.jeffw@gmail.com",
    "zamdriver3@yahoo.com",
    "fuoco911@gmail.com",
    "bwaterman2323@gmail.com",
    "yzee4@yahoo.com",
    "wheeler.chris86@gmail.com",
    "abwhitedesign@gmail.com",
    "nickpwhite@gmail.com",
    "jeff@wilcenski.com",
    "logstogs@gmail.com",
    "tim.williams.wi@gmail.com",
    "tdubbs2@gmail.com",
    "ticonderoga19@gmail.com",
    "winnap@gmail.com",
    "sccrhockylax@gmail.com",
    "bwurtz@gmail.com"
])

# Convert to lowercase for case-insensitive comparison
prod_emails = {email.lower() for email in prod_emails}

# Find missing emails
missing_in_prod = csv_emails - prod_emails

print(f"CSV has {len(csv_emails)} emails")
print(f"Production has {len(prod_emails)} emails")
print(f"\nMissing in production ({len(missing_in_prod)}):")
for email in sorted(missing_in_prod):
    name = csv_email_to_name.get(email, "Unknown")
    print(f"  {name} - {email}")
