const superagent = require('superagent');
const async = require('async');
const fs = require('fs');
// const url = require('url');
const request =require('request');
const mkdirp =require('mkdirp');
const path =require('path');
var events = require("events");
const { account, apis, downOptions } = require('./config');
// const { account, apis, downOptions } = require('./mergTS');

var emitter = new events.EventEmitter();
var authorization = '';
if(!process.argv[2]){
    console.log('error:请输入课程id')
    return;
}
var courseId = process.argv[2];

var jsonList = {};
var errorList = {};
var title = '';

var q = async.queue(function (obj,cb) {
    var delay = parseInt((Math.random() * 30000000) % 1000, 10);
    setTimeout(function() {
        downliu(obj.file, obj.arr, ()=>{
            delete jsonList[obj.file];
            write(downOptions.dirfile+`${title}.json`, jsonList);
            console.log(`${obj.file}下载结束`);
            cb();
        });
    }, delay);
}, downOptions.queue)
q.drain = function() {
    if(Object.keys(errorList).length > 0){
        for(key in errorList){
            q.push({file:key,arr:errorList[key]},function (err) {
                if(err){
                    console.log('队列出错error:', err);
                }else{
                    console.log('队列完成');
                }
        　　})
        }
        console.log('重新下载错误文件');
        errorList = {};
    }else{
        setTimeout(function() {
            fs.unlink(downOptions.dirfile+`${title}.json`,function(error){
                if(error){
                    console.log(error);
                    return false;
                }
                console.log(`删除文件${title}.json`);
            })
            fs.unlink(downOptions.dirfile+`error.json`,function(error){
                if(error){
                    console.log(error);
                    return false;
                }
                console.log(`删除文件error.json`);
            })
            console.log('所有课程下载完毕！'); 
        }, 2000);
    }
}


// 登陆
function setCookeie () {
    superagent.post(apis.login)
        .type("form")
        .send({account: account.name})
        .send({code:''})
        .send({nickname:''})
        .send({password: account.password})
        .send({thirdtype:''})
        .send({unionid:''})
        .end(function(err, res){
            if (err) throw err;
            // var cookie = res.header['set-cookie'] //从response中得到cookie
            authorization = res.header.authorization;
            emitter.emit("setCookeie", authorization);
        })
}
// 获取项目内容列表
function getDataList () {
    superagent.get("https://api.wanmen.org/4.0/content/courses/"+courseId)
        .set("authorization", authorization)
        .end(function(err, res){
            if (err){
                throw err;
            };
            title = res.body.name;

            mkdir(`${title}`);

            if(fs.existsSync(downOptions.dirfile+`${title}.json`)){
                fs.readFile(downOptions.dirfile+`${title}.json`,function(err, data) {
                    if (err) {
                        throw err;
                    }
                    let d = JSON.parse(data.toString());
                    jsonList = d;
                    for(key in d){
                        q.push({file:key,arr:d[key]},function (err) {
                            if(err){
                                console.log('队列出错error:', err);
                            }else{
                                console.log('队列完成');
                            }
                    　　})
                    }
                });
                if(fs.existsSync(downOptions.dirfile+`error.json`)){
                    fs.readFile(downOptions.dirfile+`error.json`,function(err, data) {
                        if (err) {
                            throw err;
                        }
                        let d = JSON.parse(data.toString());
                        for(key in d){
                            q.push({file:key,arr:d[key]},function (err) {
                                if(err){
                                    console.log('队列出错error:', err);
                                }else{
                                    console.log('队列完成');
                                }
                        　　})
                        }
                    });
                }
            }else{
                fs.createWriteStream(downOptions.dirfile+`${title}.json`);
                let list = res.body.lectures.map(item => {
                    mkdir(`${title}/${item.order}${item.name}`);
                    return {
                        name: item.name,
                        order: item.order,
                        hls: Object.keys(item.hls).length > 0 ? item.hls : '',
                        children: item.children.map((data,index)=>{
                            mkdir(`${title}/${item.order}${item.name}/${index+1}${data.name}`);
                            return {
                                name: data.name,
                                hls: Object.keys(data.hls).length > 0 ? data.hls : '',
                                order: data.order
                            }
                        })
                    }
                });

                getm3u8List(title,list);

                // 获取项目资料
                try{
                    if(res.body.documents.length > 0){
                        var name = `${title}/${title}资料`;
                        mkdir(name);
                        // let documents = res.body.documents.map(item=>{
                        //     // mkdir(`${title}/${item.order}${item.name}/${index+1}${data.name}`);
                        //     return {
                        //         name: item.name,
                        //         url: item.url,
                        //         ext: item.ext
                        //     }
                        // });
                        q.push({file: name, arr: res.body.documents},function (err) {
                            if(err){
                                console.log('队列出错error:', err);
                            }else{
                                console.log('资料队列完成');
                            }
                    　　})
                    }
                }catch(e) {
                    console.log('项目资料error：',e);
                }
            }
        })
};

// 获取m3u8
function getm3u8List(title,data){
    data.map(item => {
        if(item.hls){
            let url = '';
            if(item.hls.pcHigh){
                url = item.hls.pcHigh;
            }else if(item.hls.pcMid){
                url = item.hls.pcMid;
            }else if(item.hls.pcLow){
                url = item.hls.pcLow;
            }
            getm3u8(`${title}/${item.order}${item.name}`, url);
        }
        if(item.children.length>0){
            item.children.map((it,index) => {
                if(it.hls){
                    let url = '';
                    if(it.hls.pcHigh){
                        url = it.hls.pcHigh;
                    }else if(it.hls.pcMid){
                        url = it.hls.pcMid;
                    }else if(it.hls.pcLow){
                        url = it.hls.pcLow;
                    }
                    getm3u8(`${title}/${item.order}${item.name}/${index+1}${it.name}`, url);
                }
            });
        }
    })
}

function write (file,data){
    fs.writeFile(file, JSON.stringify(data), function(err) {
        if(err) {
          console.error(err);
        }
        console.log('写入json');
    })
}


function getm3u8(file,url){
    superagent.get(url)
        // .set("authorization", authorization)
        .end(function(err, res){
            if (err){
                throw err;
            };

            let data = res.body.toString().split('\n');
            let arr = [];
            for(var i=0;i<data.length;i++){
                if(data[i].indexOf('.ts')>-1){
                    arr.push({
                        name: data[i].split('.')[0],
                        url: 'https://media.wanmen.org/'+data[i],
                        ext: 'ts'
                    });
                }
            }
            jsonList[file] = arr;
            
            var name = url.split('/')[3].split('?')[0];
            fs.writeFile(downOptions.dirfile + file + '/' + name, res.body.toString(), function(err) {
                if(err) {
                    console.error(err);
                }
                console.log('保存m3u8');
            })

            q.push({file:file,arr:arr},function (err) {
                if(err){
                    console.log('队列出错error:', err);
                }else{
                    console.log('队列完成');
                }
        　　})
        })
}

// 创建目录文件
function mkdir(title) {
    console.log(`准备创建目录：${title}`);
    if (fs.existsSync(downOptions.dirfile+title)) {
        console.log(`目录：${title} 已经存在`);
        return;
    }else {
        mkdirp(downOptions.dirfile+title, function (err) {
            console.log(`目录：${title} 创建成功`);
        });
    }
}

// 下载
function downliu(dir, links, callback) {
    console.log('发现%d个文件，准备开始下载...', links.length);
    //mapLimit 控制下载文件并行上限 第二个参数 options.downLimit 就是配置
    async.mapLimit(links, downOptions.downLimit, (url,cb) => {
        //获取url最后的名字
        var fileUrl = path.basename(url.url).replace(/&nbsp;/g,'');
        var toPath = path.join(downOptions.dirfile + dir, url.name);
        console.log(`开始下载文件：${url.name}，保存到：${dir}`);
        var name = toPath+"."+url.ext;
        
        request(encodeURI(url.url),{timeout: downOptions.downLimit*60000}).on('error', function(err) {
            console.log(`文件下载失败：${url.name}`, err);
            if(errorList[dir]){
                errorList[dir].push({
                    name: url.name,
                    url: url.url,
                    ext: url.ext
                });
            }else{
                errorList[dir] = [];
                errorList[dir].push({
                    name: url.name,
                    url: url.url,
                    ext: url.ext
                });
            };
            write(downOptions.dirfile+`error.json`, errorList);
            cb();
        }).pipe(fs.createWriteStream(name)).on('finish',()=>{
            console.log(`文件下载成功：${url.name}`);
            cb();
        });
    }, callback);
}

//监听setCookeie事件
emitter.on("setCookeie", getDataList);

setCookeie();
