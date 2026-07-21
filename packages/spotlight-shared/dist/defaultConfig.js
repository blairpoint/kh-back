export const defaultFormConfig = {
    title: "Artist Submissions",
    subtitle: "Please fill out your details for the upcoming event.",
    sections: [
        {
            id: "section_1",
            title: "1. Event & Contact Info",
            fields: [
                {
                    id: "artistName",
                    type: "composite",
                    label: "Artist Name",
                    required: true,
                    subFields: [
                        { id: "djName", subtext: "DJ / Artist name", placeholder: "e.g., DJ Shadow" },
                        { id: "realName", subtext: "Real name (preferred)", placeholder: "e.g., Josh Davis" }
                    ]
                },
                {
                    id: "eventName",
                    type: "text",
                    label: "Event Name",
                    subtext: "Enter name of event eg Bloom, LMDJ, FORTUNES, etc",
                    required: false,
                    placeholder: "e.g., Bloom"
                },
                {
                    id: "email",
                    type: "email",
                    label: "Email Address",
                    required: true,
                    placeholder: "example@example.com"
                }
            ]
        },
        {
            id: "section_2",
            title: "2. Music & Socials",
            fields: [
                {
                    id: "promoTrack",
                    type: "text",
                    label: "Promo Track Link",
                    subtext: "Please link Spotify, Tidal, Beatport, Bandcamp or your own cloud share. This will be used to promote YOU.",
                    required: true,
                    placeholder: "https://soundcloud.com/..."
                },
                {
                    id: "instagram",
                    type: "text",
                    label: "Instagram Handle",
                    required: false,
                    placeholder: "@username"
                },
                {
                    id: "facebook",
                    type: "text",
                    label: "Facebook Handle",
                    required: false,
                    placeholder: "https://facebook.com/..."
                },
                {
                    id: "recordLabels",
                    type: "text",
                    label: "Record Labels",
                    required: false,
                    placeholder: "e.g., Warp Records, Ninja Tune"
                },
                {
                    id: "soundCloud",
                    type: "text",
                    label: "SoundCloud Link",
                    required: false,
                    placeholder: "https://soundcloud.com/yourprofile"
                },
                {
                    id: "beatport",
                    type: "text",
                    label: "Beatport Page Link",
                    required: false,
                    placeholder: "https://beatport.com/artist/..."
                },
                {
                    id: "bandcamp",
                    type: "text",
                    label: "Bandcamp Page Link",
                    required: false,
                    placeholder: "https://yourname.bandcamp.com"
                }
            ]
        },
        {
            id: "section_3",
            title: "3. Media & Bio",
            fields: [
                {
                    id: "bio",
                    type: "textarea",
                    label: "Artist Bio",
                    required: true,
                    placeholder: "Tell us about your musical journey, style, and influences..."
                },
                {
                    id: "profilePic",
                    type: "file",
                    label: "Profile Picture",
                    subtext: "Upload a profile picture",
                    required: true,
                    accept: "image/*"
                },
                {
                    id: "additionalPic",
                    type: "file",
                    label: "Additional Picture",
                    subtext: "Upload an additional picture (1 of 2)",
                    required: false,
                    accept: "image/*"
                },
                {
                    id: "logo",
                    type: "file",
                    label: "Artist Logo",
                    subtext: "Upload your artist 'logo' (.png please)",
                    required: false,
                    accept: "image/png"
                }
            ]
        },
        {
            id: "section_4",
            title: "4. Payout Details",
            fields: [
                {
                    id: "payoutToggle",
                    type: "text",
                    label: "Include Bank Account Details for Payouts",
                    required: false
                },
                {
                    id: "accountHolderName",
                    type: "text",
                    label: "Account Holder Name",
                    required: true,
                    placeholder: "e.g., Josh Davis"
                },
                {
                    id: "bankName",
                    type: "text",
                    label: "Bank Name",
                    required: true,
                    placeholder: "e.g., Chase Bank"
                },
                {
                    id: "accountNumber",
                    type: "text",
                    label: "Account Number / IBAN / Routing Number",
                    required: true,
                    placeholder: "e.g., US1234567890"
                }
            ]
        }
    ]
};
