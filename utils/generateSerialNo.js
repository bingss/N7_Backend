const shortUniqueId = require('short-unique-id')

const generateSerialNo = (prefix, uuidLength) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;
    const uid = new shortUniqueId();

    return `${prefix}${todayStr}${uid.randomUUID(uuidLength)}`;
}

module.exports = generateSerialNo


      //流水編版號碼
      // const repository = event.manager.getRepository("User");
      // const lastUser = await repository
      //   .createQueryBuilder("user")
      //   .where("user.serial_no LIKE :today", { today: `M${todayStr}%` })
      //   .orderBy("user.serial_no", "DESC")
      //   .getOne();
  
      // let nextNumber = 1;
      // if (lastUser) {
      //   const lastSerialNo = lastUser.serial_no;
      //   const lastNumber = parseInt(lastSerialNo.slice(-3));
      //   nextNumber = lastNumber + 1;
      // }
      // const serialNo = `U${todayStr}${String(nextNumber).padStart(3, "0")}`;

