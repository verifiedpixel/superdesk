!function(){"use strict";return angular.module("superdesk.asset",["superdesk.config"]).provider("asset",["$injector",function(a){this.templateUrl=function(b){var c=a.get("config"),d=b;return/^(https?:\/\/|\/\/|\/|.\/|..\/)/.test(b)||(d="scripts/"+d),!/^(https?:\/\/|\/\/)/.test(b)&&c.paths&&c.paths.superdesk&&(d=c.paths.superdesk+d),d=d.replace(/[^\/]+\/+\.\.\//g,"").replace(/\.\//g,"").replace(/(\w)\/\/(\w)/g,"$1/$2")},this.imageUrl=this.templateUrl,this.$get=function(){return this}}])}(),function(){"use strict";function a(a,b){return{templateUrl:"/views/main.html",link:function(c,d,e){c.scrollTo=function(c){a.hash(c),b()},c.modalActive=!1,c.openModal=function(){c.modalActive=!0},c.closeModal=function(){c.modalActive=!1},c.opts=["Serbia","Czech Republic","Germany","Australia"],c.taTerms=["Serbia","Czech Republic","Germany","Australia","Canada","Russia","Italy","Egypt","China"],c.taSelected=null,c.taItems=[],c.taSearch=function(a){return c.taItems=_.filter(c.taTerms,function(b){return-1!==b.toLowerCase().indexOf(a.toLowerCase())}),c.taItems},c.taSelect=function(a){c.taSelected=a},c.dateNow=moment().utc().format(),c.timeNow=moment().utc().format("HH:mm:ss")}}}var b=angular.module("superdesk.docs",[]);return a.$inject=["$location","$anchorScroll"],b.directive("sdDocs",a),b.directive("prettyprint",function(){return{restrict:"C",link:function(a,b,c){for(var d=b[0].innerHTML,e=0,f=0;32===d.charCodeAt(e);)f+=1,e+=1;var g="\\s{"+f+"}",h=new RegExp(g,"g");b[0].innerHTML=d.replace(h,"\n"),b.find('[ng-non-bindable=""]').each(function(a,b){$(b).removeAttr("ng-non-bindable")});var i=c["class"].match(/\blang(?:uage)?-([\w.]+)(?!\S)/);i&&(i=i[1]),b.html(window.prettyPrintOne(_.escape(b.html()),i,!0))}}}),b}();