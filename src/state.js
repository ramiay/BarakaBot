// In-memory user state (reset on server restart)
const usersState = new Map();

function ensureUser(from) {
    if (!usersState.has(from)) {
        usersState.set(from, { profile: '', style: 'minimal', lastPreview: null });
    }
    return usersState.get(from);
}

module.exports = { usersState, ensureUser };
