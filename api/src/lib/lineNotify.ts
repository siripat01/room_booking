export async function sendLineNotify(token: string, message: string) {
    if (!token) return;
    await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ message }),
    }).catch(console.error);
}
