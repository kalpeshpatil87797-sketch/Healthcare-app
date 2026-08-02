const sessoinIdUserMap = new Map();

function setUser(id, user){
    sessoinIdUserMap.set(id, user);
}

function getUser(id){
    return sessoinIdUserMap.get(id);

}

module.exports = {
    setUser,
    getUser,
};