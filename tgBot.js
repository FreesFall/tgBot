const { Telegraf,session  } = require('telegraf');
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
console.log('start:',"start");
const {insertUser,deleteUser,getUser} = require('./userdb');
const TelegrafI18n   = require('telegraf-i18n');
const dotenv = require('dotenv');
dotenv.config();


// Bot Token
const bot = new Telegraf(process.env.BOTTOKEN);
const provider = new ethers.providers.JsonRpcProvider(process.env.URL);
const contractAddress = process.env.CONTRACT_ADDRESS;

// 读取 ABI 文件
const abiPath = path.join(__dirname, 'abi', 'ClubhouseFarming.json');
const contractABI = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
const contract = new ethers.Contract(contractAddress, contractABI, provider);

  


// 配置 i18n
const i18n = new TelegrafI18n({
    defaultLanguage: 'en', 
    directory: path.join(__dirname, 'i18n'),
    queryParameter: 'lang', 
    useSession: true, 
    autoReload: true,
    syncFiles: true
});
// 使用 session 中间件
bot.use(session());
// 将 i18n 中间件添加到 bot 实例中
bot.use(i18n.middleware());
// 用于存储用户的挑战字符串和绑定结果
const userChallenges = {}; // { telegram_id: { challenge: "random_string", wallet: "0x..." } }
// 生成随机签名hash
function generateChallenge() {
    return crypto.randomBytes(16).toString('hex');
}

//VIP 群组条件
const groups = JSON.parse(process.env.GROUPS);
const thresholds = JSON.parse(process.env.GROUPS_THRESHOLD);
const groupConditions = new Map();
groups.forEach((group, index) => {
    groupConditions.set(group, { lockAmountThreshold: thresholds[index] });
});
// 输出结果
console.log("groupConditions",groupConditions);
function erroTip(ret,ctx){
    if(!ret){
        ctx.reply(`操作失败`);
        return;
    }
}



language="zh";
// 启动命令
bot.command('start', (ctx) => {
    ctx.i18n.locale('en'); // 设置当前语言
    if (ctx.chat.type === 'private') {
        ctx.reply('欢迎！请选择操作：', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '中文', callback_data: 'zh' },
                { text: 'ENGLISH', callback_data: 'en' }],
              ]
            }
        });
    }

});


// 处理语言选择
bot.action(['zh', 'en'], async (ctx) => {
    language=ctx.callbackQuery.data;
    ctx.i18n.locale(language); // 切换语言
    await  ctx.reply(ctx.i18n.t('Please_select'), {
        reply_markup: {
            inline_keyboard: [
                [{ text: ctx.i18n.t('Bind Wallet'), callback_data: 'bind_wallet' }],
                [{ text: ctx.i18n.t('Check Wallet'), callback_data: 'get_wallet' }],
                [{ text: ctx.i18n.t('Unbind Wallet'), callback_data: 'del_wallet' }]
            ]
        }
    });
});

// 处理绑定钱包按钮
bot.action('bind_wallet', (ctx) => {
    ctx.i18n.locale(language); 
    bindWalletHandler(ctx);
});
  
// 处理查询钱包按钮
bot.action('get_wallet', (ctx) => {
    ctx.i18n.locale(language); 
    getWalletHandler(ctx);
});

// 处理查询钱包按钮
bot.action('del_wallet', (ctx) => {
    ctx.i18n.locale(language); 
    deleteWalletHandler(ctx);
});
  
// 处理绑定钱包事件
function bindWalletHandler(ctx) {
    const userId = ctx.from.id;
    const challenge = generateChallenge();
    userChallenges[userId] = { challenge };
    ctx.reply(`${ctx.i18n.t('signing messages')}: ${challenge}\n${ctx.i18n.t('copy the signing message to sign')}\n${ctx.i18n.t('signature link')}: http://localhost:3000`);
}
  
// 处理查询钱包事件
async function getWalletHandler(ctx) {
    const userId = ctx.from.id;
    // const wallet = userBindings[userId];
    const user =await getUser(userId);
    if (user) {
        ctx.reply(`${ctx.i18n.t('your bound wallet address is')}: ${user.address}`);
    } else {
        ctx.reply(ctx.i18n.t('you have not yet bound the wallet address, please bind first'));
    }
}
  
// 处理解绑钱包事件
async function deleteWalletHandler(ctx) {
    const userId = ctx.from.id;
    const user =await getUser(userId);
    if (user) {
        const ret=deleteUser(userId, ctx);
        erroTip(ret,ctx);
        kickUserFromGroups(userId,groupConditions.keys());
        ctx.reply(ctx.i18n.t('Unwallet'));
    } else {
        ctx.reply(ctx.i18n.t('you have not yet bound the wallet address, please bind first'));
    }
}



// 监听新成员加入群组
bot.on('new_chat_members', async (ctx) => {

    const newMember = ctx.message.new_chat_members[0];
    const userId = newMember.id;
    const groupId = ctx.chat.id; 
    const user=await getUser(userId);
    console.log("user",user);
    if(!user){
        ctx.reply("Please bind your wallet first! Private chat me to bind, I will kick you out after 5 seconds.");
        // 设置倒计时，5秒后踢出该用户
        setTimeout(async () => {
            try {
                // 使用 banChatMember 方法踢出用户，直到指定的时间（此处为立即踢出）
                await bot.telegram.banChatMember(groupId, userId, { until_date: Math.floor(5000 / 1000) });
                console.log(`用户 ${userId} 已被踢出`);
            } catch (err) {
                console.error('踢出失败:', err);
            }
        }, 5000); 
        return; 
    }
    const wallet=user.address;
    try {
        const checkAmount=groupConditions.get(`${groupId}`);
        // 读取智能合约中的用户锁仓数量
        const lockedAmount = await getVeEBENAmount(wallet);
        // 判断锁仓数量是否满足条件
        console.log("lockedAmount",checkAmount)
        if (lockedAmount.lt(ethers.BigNumber.from(checkAmount.lockAmountThreshold))) {
            console.log(`锁仓数量 ${lockedAmount.toString()} 小于阈值，踢出该用户`);
            // 踢出用户
            await bot.telegram.banChatMember(groupId, userId, { until_date: Math.floor(5000 / 1000) });
            console.log(`用户 ${ctx.message.from.username} 已被踢出群组`);
        } else {
            console.log(`锁仓数量 ${lockedAmount.toString()} 满足条件，保留在群组`);
        }
    } catch (error) {
        console.error('处理用户时出错:', error);
    }
});

// 绑定钱包
bot.on('text', async (ctx) => {
    ctx.i18n.locale(language); 

    const userId = ctx.from.id; // 获取发送消息的用户的 userId
    console.log("new user",userId)
    if (ctx.chat.type !== 'private') {
        return; 
    }
    const signedMessage = ctx.message.text.trim();
    if (!userChallenges[userId]) {
        ctx.reply(ctx.i18n.t('you have not yet bound the wallet address, please bind first'));
        return;
    }

    const { challenge } = userChallenges[userId];
    try {
        // 验证签名并获取签名的钱包地址
        const recoveredAddress = ethers.utils.verifyMessage(challenge, signedMessage);
        if(recoveredAddress){
            const  ret=insertUser(userId,recoveredAddress);
            erroTip(ret);
            delete userChallenges[userId];
            ctx.reply(`${ctx.i18n.t('Binding_successful')}${recoveredAddress}`);
        }
    } catch (error) {
        console.error('签名验证失败:', error);
        ctx.reply(ctx.i18n.t("Signature_verification"));
    }
});


// getVeEben amount
async function getVeEBENAmount(userAddress) {
    try {
        // 调用智能合约的 `userInfos` 方法，假设返回的是锁仓数量
        const lockedAmount = await contract.userInfos(userAddress);
        const amount=(ethers.BigNumber.from(lockedAmount[0])).div(ethers.BigNumber.from('10').pow(18));
        console.log('amount:',amount.toString());
        return  amount;  // 假设 `userInfos` 返回的是一个元组，锁仓数量在第一个位置
    } catch (error) {
        console.error('获取锁仓数量失败:', error);
        return  ethers.BigNumber.from(0);  // 如果获取失败，返回 0
    }
}
async function kickUserFromGroups(userId, groupIds) {
    for (let groupId of groupIds) {
      try {
        // 获取用户在群组中的状态
        const member = await bot.telegram.getChatMember(groupId, userId);
  
        // 如果用户在群组中是 "member" 状态
        if (member.status === 'member') {
          console.log(`用户 ${userId} 存在于群组 ${groupId} 中，正在踢出`);
          // 执行踢出操作
          await bot.telegram.banChatMember(groupId, userId);
          console.log(`用户 ${userId} 已被踢出群组 ${groupId}`);
        } else {
          console.log(`用户 ${userId} 不在群组 ${groupId} 中，状态: ${member.status}`);
        }
      } catch (err) {
        console.error(`处理用户 ${userId} 在群组 ${groupId} 中的状态时失败:`, err);
      }
    }
}


// 启动机器人
bot.launch()
    .then(() => console.log('Bot is running'))
    .catch((err) => console.error('Bot failed to start:', err));


    