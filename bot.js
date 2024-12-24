const { Telegraf } = require('telegraf');
const { ethers } = require('ethers');
const crypto = require('crypto');

// 替换为你的 Bot Token
const bot = new Telegraf('7831280551:AAFB_grlyCICooJw2PAPsCAaKtQhi1aFhH0');

// 处理 /start 命令
bot.start((ctx) => ctx.reply('test!'));

// // 处理普通消息
// bot.on('text', (ctx) => {
//     ctx.reply(`You said: ${ctx.message.text}`);
// });


// 模拟存储：用于存储用户的挑战字符串和绑定结果
const userChallenges = {}; // { telegram_id: { challenge: "random_string", wallet: "0x..." } }
const userBindings = {}; // { telegram_id: wallet_address }

// 生成随机挑战字符串
function generateChallenge() {
    return crypto.randomBytes(16).toString('hex');
}

// 第一步：生成挑战字符串
bot.command('bind_wallet', (ctx) => {
    const userId = ctx.from.id;
    const challenge = generateChallenge();

    // 保存挑战字符串
    userChallenges[userId] = { challenge };
    ctx.reply(`请用您的钱包签名以下信息，并将签名结果发送给我：\n\n${challenge}`);
});

// // 第二步：接收签名并验证
// bot.on('text', async (ctx) => {
//     const userId = ctx.from.id;
//     const signedMessage = ctx.message.text.trim();

//     if (!userChallenges[userId]) {
//         ctx.reply('您需要先使用 /bind_wallet 生成挑战字符串。');
//         return;
//     }

//     const { challenge } = userChallenges[userId];

//     try {
//         // 验证签名并获取签名的钱包地址
//         const recoveredAddress = ethers.utils.verifyMessage(challenge, signedMessage);

//         // 保存绑定关系
//         userBindings[userId] = recoveredAddress;
//         delete userChallenges[userId];

//         ctx.reply(`绑定成功！您的钱包地址为：${recoveredAddress}`);
//     } catch (error) {
//         console.error('签名验证失败:', error);
//         ctx.reply('签名验证失败，请确保您正确签名了机器人提供的挑战字符串。');
//     }
// });


// 新用户加入事件
bot.on('new_chat_members', (ctx) => {
    const newMembers = ctx.message.new_chat_members;

    newMembers.forEach((member) => {
        const userId = member.id;
        const username = member.username || member.first_name || '用户';
        console.log("member",member)
        // 通知用户需要绑定钱包
        ctx.reply("1111")
    });
});

// get
bot.command('get_wallet', (ctx) => {
    const userId = ctx.from.id;
    const wallet = userBindings[userId];

    if (wallet) {
        ctx.reply(`您绑定的钱包地址为：${wallet}`);
    } else {
        ctx.reply('您尚未绑定钱包地址，请使用 /bind_wallet 进行绑定。');
    }
});



// 启动机器人
bot.launch()
.then(() => console.log('Bot is running'))
.catch((err) => console.error('Bot failed to start:', err));
