const account = {
    name: '',
    password: ''
};

const apis = {
    login: 'https://api.wanmen.org/4.0/main/signin', //登陆
};

const downOptions = {
    uri: '',
    dirfile: './output/', //保存目录
    downLimit: 5, //文件并行下载上限,
    queue: 2 // 队列并行上限
}

module.exports = {
    account,
    apis,
    downOptions
};