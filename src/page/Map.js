import React from "react";
import fengmap from "fengmap/build/plugins/fengmap.core.min"; //核心包
import "fengmap/build/plugins/fengmap.control.min"; //控件
// 导航需要引入以下两个包：
import "fengmap/build/plugins/fengmap.analyzer.min"; //路径分析类
import "fengmap/build/plugins/fengmap.navi.min"; //导航类

import "./map.css";
var clickCount = 0;
//判断起点是否是同一处坐标
var lastCoord = null;
//起终点坐标
var coords = [];
var naviAnalyser = null;
var layers = [];
var navi = null;

export default class Map extends React.Component {
  constructor(props) {
    super(props);
    this.map = null;
    this.state = {
      degree: 0,
    };
  }

  componentDidMount() {
    let fmapID = "xxxxx";
    this.openMap(fmapID);
  }

  // fmapID：应用ID
  openMap = (fmapID) => {
    let mapOptions = {
      container: document.getElementById("fmap"),
      // 地图数据位置
      mapServerURL: "./data/" + fmapID,
      // 主题数据位置
      // mapThemeURL: './data/theme',
      defaultThemeName: "2001",
      // 必要，地图应用名称，通过蜂鸟云后台创建
      appName: "shangyan",
      // 必要，地图应用密钥，通过蜂鸟云后台获取
      key: "92a2b21f85c5ce7dc36ce5dbfda93b19",
      defaultVisibleGroups: [7],
      defaultFocusGroup: 7,
    };
    this.map = new fengmap.FMMap(mapOptions);
    this.map.openMapById(fmapID, (error) => {
      console.log(error);
    });

    this.map.on("loadComplete", (e) => {
      console.log("地图加载完成！");
      // 指定初始显示楼层
      let list = this.map.getDatasByAlias(7, 'model', null)
      let arrays = [];
      list.forEach(each => {
        if (each.target.name) {
          arrays.push(each)
        }
      });
      console.log(arrays)
      naviAnalyser = new fengmap.FMNaviAnalyser(this.map);
      // 加载楼层控制条
      this.loadScrollFloorCtrl();
    });

    this.map.on('mapClickNode', (event) => {
      if (event.target && event.target.nodeType == fengmap.FMNodeType.MODEL && naviAnalyser) {
        //封装点击坐标，模型中心点坐标
        var coord = {
          x: event.target.mapCoord.x,
          y: event.target.mapCoord.y,
          groupID: event.target ? event.target.groupID : 1
        };
        //第一次点击
        if (clickCount === 0) {
          //记录点击坐标
          lastCoord = coord;
          //设置起点坐标
          coords[0] = coord;

          //添加起点imageMarker
          //this.addMarker(coord, 'start');
        } else if (clickCount === 1) {
          //第二次点击，添加终点并画路线
          //判断起点和终点是否相同
          if (lastCoord.x === coord.x && lastCoord.y === coord.y) {
            return;
          }

          //设置终点坐标
          coords[1] = coord;
          //添加终点imageMarker
          //this.addMarker(coord, 'end');

          //设置完起始点后，调用此方法画出导航线
          //this.drawNaviLine();
        } else {
          //第三次点击，重新开始选点进行路径规划
          //重置路径规划
          this.resetNaviRoute();

          //记录点击坐标
          lastCoord = coord;
          //设置起点坐标
          coords[0] = coord;
          //添加起点imageMarker
          this.addMarker(coord, 'start');
        }
        clickCount++;
      }
    });
  }

  drawNaviLine() {
    //根据已加载的fengmap.FMMap导航分析，判断路径规划是否成功
    var analyzeNaviResult = naviAnalyser.analyzeNavi(coords[0].groupID, coords[0], coords[1].groupID, coords[1],
      fengmap.FMNaviMode.MODULE_SHORTEST);
    if (fengmap.FMRouteCalcuResult.ROUTE_SUCCESS != analyzeNaviResult) {
      return;
    }

    //获取路径分析结果对象，所有路线集合
    var results = naviAnalyser.getNaviResults();

    //初始化线图层
    var line = new fengmap.FMLineMarker();
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      //楼层id
      var gid = result.groupId;
      //路径线点集合
      var points = result.getPointList();

      var points3d = [];
      points.forEach(function (point) {
        points3d.push({
          //x坐标点
          'x': point.x,
          //y坐标点
          'y': point.y,
          //线标注高度
          'z': 1
        });
      });

      /**
       * fengmap.FMSegment点集，一个点集代表一条折线
       * https://developer.fengmap.com/docs/js/v2.7.1/fengmap.FMSegment.html
       * */
      var seg = new fengmap.FMSegment();
      seg.groupId = gid;
      seg.points = points3d;
      line.addSegment(seg);
    }

    //配置线型、线宽、透明度等
    var lineStyle = {
      //设置线的宽度
      lineWidth: 6,
      //设置线的透明度
      alpha: 0.8,
      //设置线的类型为导航线
      lineType: fengmap.FMLineType.FMARROW,
      //设置线动画,false为动画
      noAnimate: false
    };

    //画线
    this.map.drawLineMark(line, lineStyle);
  }

  addMarker(coord, type) {
    //获取目标点层
    var group = this.map.getFMGroup(coord.groupID);
    //创建marker，返回当前层中第一个imageMarkerLayer,如果没有，则自动创建
    var layer = group.getOrCreateLayer('imageMarker');
    //判断该楼层layer是否存在，清除marker时需要将所有楼层marker都清除
    let isExistLayer = layers.some(function (item, index, array) {
      return item.groupID === coord.groupID;
    });
    if (!isExistLayer) {
      layers.push(layer);
    }
    var markerUrl = '';
    if (type === 'start') {
      markerUrl = 'start.png';
    } else {
      markerUrl = 'end.png';
    }
    //图标标注对象，默认位置为该楼层中心点
    var im = new fengmap.FMImageMarker({
      x: coord.x,
      y: coord.y,
      //设置图片路径
      url: markerUrl,
      //设置图片显示尺寸
      size: 32,
      //marker标注高度
      height: 2
    });
    //添加imageMarker
    layer.addMarker(im);
  }

  createNavi = () => {
    if (!navi) {
      //初始化导航对象
      navi = new fengmap.FMNavigation({
        //地图对象
        map: this.map,
        //导航结果文字描述内容的语言类型参数, 目前支持中英文。参考FMLanguaeType。
        naviLanguage: fengmap.FMLanguageType.ZH,
        //导航中路径规划模式, 支持最短路径、最优路径两种。默认为MODULE_SHORTEST, 最短路径。
        naviMode: fengmap.FMNaviMode.MODULE_SHORTEST,
        //导航中的路线规划梯类优先级, 默认为PRIORITY_DEFAULT, 详情参考FMNaviPriority。
        naviPriority: fengmap.FMNaviPriority.PRIORITY_DEFAULT,
        //导航线与楼层之间的高度偏移设置。默认是1。
        lineMarkerHeight: 1.5,
        // 设置导航线的样式
        lineStyle: {
          // 导航线样式
          lineType: fengmap.FMLineType.FMARROW,
          // 设置线的宽度
          lineWidth: 6,
          //设置线动画,false为动画
          noAnimate: false
        }
      });
    }

    //添加起点
    navi.setStartPoint({
      x: coords[0].x,
      y: coords[0].y,
      groupID: coords[0].groupID,
      url: 'start.png',
      size: 32
    });

    //添加终点
    navi.setEndPoint({
      x: coords[1].x,
      y: coords[1].y,
      groupID: coords[1].groupID,
      url: 'end.png',
      size: 32
    });

    // 画出导航线
    navi.drawNaviLine();

    //根据焦点层得到路径数据
    this.showFocusNaviInfo(this.map.focusGroupID);

    //得到此导航路径的文字描述数据
    var naviDescriptions = navi.naviDescriptions;

    //显示路径信息
    this.showNaviDesc(naviDescriptions);
    navi.simulate();
  }

  showFocusNaviInfo(gid) {
    var focusNaviDesc = document.getElementById('focusNaviDesc');

    //聚焦楼层路径距离
    var naviFocusDistance = null;
    for (var i = 0; i < navi.naviGroupsDistance.length; i++) {
      var data = navi.naviGroupsDistance[i];
      if (data.groupID === gid) {
        naviFocusDistance = data.distance.toFixed(1);
        break;
      }
    }

    //如果是中间层，则显示0
    if (naviFocusDistance) {
      //普通人每分钟走80米。
      var time = naviFocusDistance / 80;
      var m = parseInt(time);
      var s = Math.ceil((time % 1) * 60);
      focusNaviDesc.innerHTML = '<p>当前层：' + gid + ' </p><p>该楼层路径距离：' + naviFocusDistance +
        '  米     </p><p>大约需要：  ' + m + '  分钟   ' + s + '   秒</p>';
    } else {
      focusNaviDesc.innerHTML = '<p>当前层：' + gid + ' </p><p>该楼层路径距离：0  米     </p><p>大约需要： 0 分钟   0   秒</p>';
    }

    document.getElementById('focusNaviDesc').style.display = 'block';
  }

  showNaviDesc(naviDescriptions) {
    //获取Dom元素
    var oNaviInfo = document.getElementById('pathInfo').getElementsByTagName('ul')[0];
    var liHtml = '';
    for (var i = 0; i < naviDescriptions.length; i++) {
      liHtml += '<li>' + naviDescriptions[i] + '</li>'
    }

    oNaviInfo.innerHTML = '<h4>起点：xx1</h4>' + liHtml + '<h4>终点：xx2</h4>';
    //点击路径描述跳转到对应路段
    var domLi = oNaviInfo.getElementsByTagName('li');
    for (var i = 0; i < domLi.length; i++) {
      (function (i) {
        domLi[i].onclick = function () {
          var index = i;
          //修改地图倾斜角度
          this.map.tiltTo({
            to: 85,
            duration: .8
          });

          // 聚焦到点击的路段
          navi.focusNaviLineSegment(index, {
            //聚焦范围的比例尺放大缩小比例, 默认为1.3, 当数字大于1时比例尺变大, 聚焦后地图显示会缩小。小于1地图则会看起来更大。
            extendScale: 3,
            //动画时长
            duration: .8,
            callback: () => {
              this.showFocusNaviInfo(this.map.focusGroupID);
            }
          });
        }
      })(i);
    }

    document.getElementById('pathInfo').style.display = 'block';
  }

  resetNaviRoute() {
    //清空导航线
    this.map.clearLineMark();
    //清空起点、终点marker
    layers.forEach(function (layer, index) {
      if (layer) {
        layer.removeAll();
      }
    });
    //重置地图点击次数
    clickCount = 0;
    //重置上一次点击坐标对象
    lastCoord = null;
  }

  // 加载滚动型楼层切换控件
  loadScrollFloorCtrl() {
    let scrollFloorCtlOpt = {
      position: fengmap.FMControlPosition.LEFT_TOP,
      showBtnCount: 7,
      allLayer: false,
      needAllLayerBtn: true,
      offset: {
        x: 20,
        y: 20,
      },
      // 配置图片资源的路径地址
      // imgURL: "./images/"
    };
    let scrollFloorControl = new fengmap.FMScrollGroupsControl(
      this.map,
      scrollFloorCtlOpt
    );
    // 楼层切换
    scrollFloorControl.onChange((groups, allLayer) => {
      console.log(groups);
    });
  }

  rotate = (degree) => {
    this.setState({ degree }, () => {
      this.map.rotateAngle = this.state.degree;
    });
  };

  angle = (angle) => {
    this.map.tiltAngle = angle;
  };

  revertAngle = () => {
    this.map.tiltAngle = 30;
  }

  onTextMarker = () => {
    var group = this.map.getFMGroup(this.map.focusGroupID); //获取当前聚焦楼层
    var layer = group.getOrCreateLayer('textMarker'); //返回当前层中第一个textMarkerLayer,如果没有，则自动创建

    var gpos = group.mapCoord;  //文字标注对象，默认位置为该楼层中心点
    var tm = new fengmap.FMTextMarker({
      x: gpos.x,  //标注x坐标点
      y: gpos.y,  //标注y坐标点
      name: "这是一个文字标注", //标注值
      fillcolor: "255,0,0",  //文本标注填充色
      fontsize: 20,   //文本标注字体大小
      strokecolor: "255,255,0" //文本标注边线颜色
    });

    /**
     * textMarker添加自定义属性
     **/
    tm.selfAttr = '自定义属性selfAttr';

    layer.addMarker(tm);  //文本标注层添加文本Marker
  }

  onImageMarker = () => {
    var group = this.map.getFMGroup(this.map.focusGroupID); //获取当前聚焦楼层
    /*//实例化方法1：自定义图片标注层
     layer = new fengmap.FMImageMarkerLayer();
     //添加图片标注层到模型层
     group.addLayer(layer);*/

    //实例化方法2：
    //返回当前层中第一个imageMarkerLayer,如果没有，则自动创建
    var layer = group.getOrCreateLayer('imageMarker');

    //图标标注对象，默认位置为该楼层中心点
    var gpos = group.mapCoord;
    var im = new fengmap.FMImageMarker({
      //标注x坐标点
      x: gpos.x,
      //标注y坐标点
      y: gpos.y,
      //设置图片路径
      url: 'redImageMarker.png',
      //设置图片显示尺寸
      size: 30,
      //标注高度，大于model的高度
      height: 4
    });

    /**
     * imageMarker添加自定义属性
     **/
    im.selfAttr = '自定义属性selfAttr';

    layer.addMarker(im);
  }

  onPointMarker = () => {
    var group = this.map.getFMGroup(this.map.focusGroupID);
    var gpos = group.mapCoord;
    var locationMarker = new fengmap.FMLocationMarker({
      url: 'pointer.png',
      size: 50,  //设置图片显示尺寸
      height: 5  //marker标注高度
    });

    this.map.addLocationMarker(locationMarker);
    locationMarker.setPosition({
      x: gpos.x,  //设置定位点的x坐标
      y: gpos.y,  //设置定位点的y坐标
      groupID: this.map.focusGroupID  //设置定位点所在楼层
    });
  }

  onPolygonMarker = () => {
    //创建自定义多边形形状PolygonMarker所需的顶点数组
    var coords = [{ x: 13513168, y: 3654397, z: 56 },
    { x: 13654397, y: 3654397, z: 56 },
    { x: 12961680, y: 4861854, z: 56 },
    { x: 12961637, y: 4861819, z: 56 },
    { x: 12961590, y: 4861835, z: 56 }
    ];

    var groupLayer = this.map.getFMGroup(this.map.focusGroupID);
    //创建PolygonMarkerLayer
    var layer = groupLayer.getOrCreateLayer('polygonMarker');//返回当前层中第一个polygonMarker,如果没有，则自动创建
    groupLayer.addLayer(layer);

    var polygonMarker = new fengmap.FMPolygonMarker({
      alpha: .5,             //设置透明度
      lineWidth: 1,      //设置边框线的宽度
      height: 6,    //设置高度*/
      points: coords //多边形坐标点
    });

    layer.addMarker(polygonMarker);  //文本标注层添加文本Marker
  }

  onSearch = () => {
    var searchAnalyser = new fengmap.FMSearchAnalyser(this.map);
    //默认针对所有类型的地图元素的查询
    var searchReq = new fengmap.FMSearchRequest();
    searchReq.groupID = this.map.focusGroupID; //查询出楼层ID= 1的所有地图元素，包括model,label,facility,marker等。
    searchReq.keyword = 'space365实验室'; //查询出所有楼层的地图元素中name包含'APP'的对象集合。
    var sortRes = searchAnalyser.getQueryResult(searchReq, ['SINGLE']);

    var resultHtml = '';
    for (var i = 0; i < sortRes.length; i++) {
      var model = sortRes[i];
      if (!model.name) {
        continue;
      }
      resultHtml += '<li onClick="findModelByFid(\'' + model.FID + '\', \'' + model.name + '\')">' + model.name + '</li>';
    }


    var oHotwords = document.getElementById('hotwords');
    oHotwords.innerHTML = resultHtml;
    oHotwords.style.display = 'block';
  }

  render() {
    return (
      <div style={{ marginLeft: 10 }}>
        <div style={{ marginBottom: 10, marginTop: 10 }}>
          <button style={{ marginRight: 10 }} onClick={() => this.rotate(30)}> 旋转30°</button>
          <button style={{ marginRight: 10 }} onClick={() => this.rotate(60)}> 旋转60°</button>
          <button style={{ marginRight: 10 }} onClick={() => this.rotate(90)}> 旋转90°</button>
          <button style={{ marginRight: 10 }} onClick={() => this.rotate(-20)}> 还原角度</button>
          <button style={{ marginRight: 10 }} onClick={this.onTextMarker}>文字标注</button>
          <button style={{ marginRight: 10 }} onClick={this.onImageMarker}>图片标注</button>
          <button style={{ marginRight: 10 }} onClick={this.onPointMarker}>定位标注</button>
          <button style={{ marginRight: 10 }} onClick={this.onPolygonMarker}>绘制多边形</button>
          <button style={{ marginRight: 10 }} onClick={this.onSearch}>查询space365实验室</button>
        </div>
        <div>
          <button style={{ marginRight: 10 }} onClick={() => this.angle(90)}>俯视图</button>
          <button style={{ marginRight: 10 }} onClick={() => this.angle(45)}>侧视图45°</button>
          <button onClick={() => this.revertAngle()}> 还原视图</button>
        </div>
        <div>
          <button onClick={this.createNavi}> 开始导航</button>
        </div>
        <div id="focusNaviDesc" className="focusNaviDesc"></div>
        <div id="pathInfo" className="pathInfo scroll">
          <ul></ul>
        </div>
        <ul id="hotwords" className="hotwords scroll">
        </ul>
        <div id="fmap"> </div>
      </div>
    );
  }
}
