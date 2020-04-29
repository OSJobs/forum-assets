/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += "읽지 않은 글 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "is <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 개</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 개</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ", 새 글은 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 개</a> ";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 개</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 을 확인해보세요, ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += " 카테고리의 다른 글들도 살펴보세요.";
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "지금 이 사용자의 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>개의 포스트";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> 개의 포스트";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 와 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>개의 토픽";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>개의 토픽";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 을 삭제하고, 계정을 삭제한 다음 IP 주소<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b>에서의 가입 시도를 차단하며, 이메일 주소<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 를 영구 정지 목록에 추가하려고 합니다. 이 사용자가 스패머인 것이 확실합니까?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "\n이 토픽에는 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "포스트 대비 높은 좋아요를 받은";
return r;
},
"med" : function(d){
var r = "";
r += "포스트 대비 매우 높은 좋아요를 받은";
return r;
},
"high" : function(d){
var r = "";
r += "포스트 대비 엄청나게 높은 좋아요를 받은";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 개";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 개의 답글이 있습니다.";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1개의 포스트";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "개의 포스트";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " 와 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1개의 토픽";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "개의 토픽";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "을 삭제하려고 합니다. 정말로 삭제할까요?";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ko"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.ko = function ( n ) {
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"ko":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"바이트"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}천","millions":"{{number}}백만"}},"dates":{"time":"a h:mm","time_with_zone":"a h:mm (z)","timeline_date":"YYYY MMM","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"YYYY MMM D a h:mm","long_with_year_no_time":"YYYY MMM D","full_with_year_no_time":"YYYY MMMM Do","long_date_with_year":"'YY MMM D. LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"'YY MMM D","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"'YY MMM D \u003cbr/\u003eLT","wrap_ago":"%{date}전","tiny":{"half_a_minute":"\u003c 1분","less_than_x_seconds":{"other":"\u003c %{count}초"},"x_seconds":{"other":"%{count}초전"},"less_than_x_minutes":{"other":"\u003c %{count}분"},"x_minutes":{"other":"%{count}분전"},"about_x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일전"},"x_months":{"other":"%{count}달"},"about_x_years":{"other":"%{count}년"},"over_x_years":{"other":"\u003e %{count}년"},"almost_x_years":{"other":"%{count}년"},"date_month":"MMM D","date_year":"'YY MMM"},"medium":{"x_minutes":{"other":"%{count}분"},"x_hours":{"other":"%{count}시간"},"x_days":{"other":"%{count}일"},"date_year":"'YY MMM D"},"medium_with_ago":{"x_minutes":{"other":"%{count}분 전"},"x_hours":{"other":"%{count}시간 전"},"x_days":{"other":"%{count}일 전"},"x_months":{"other":"%{count}달 전"},"x_years":{"other":"%{count}년 전"}},"later":{"x_days":{"other":"%{count}일 후"},"x_months":{"other":"%{count}달 후"},"x_years":{"other":"%{count}년 후"}},"previous_month":"지난 달","next_month":"다음 달","placeholder":"날짜"},"share":{"topic_html":"토픽: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"포스트 #%{postNumber}","close":"닫기","twitter":"링크를 트위터에 공유","facebook":"링크를 페이스북에 공유","email":"링크를 이메일로 공유"},"action_codes":{"public_topic":"이 글을 %{when} 에 공개","private_topic":"이 토픽을 보관 %{when}","split_topic":"이 글을 %{when}에 분리","invited_user":"%{who}이(가) %{when}에 초대됨","invited_group":"%{who} 이(가) %{when} 에 초대됨","user_left":"%{when} 이 메시지에서 %{who} 자신을 삭제했습니다","removed_user":"%{who}이(가) %{when}에 삭제됨","removed_group":"%{who}이(가) %{when}에 삭제됨","autobumped":"%{when}에 자동으로 끌어올려짐","autoclosed":{"enabled":"%{when}에 닫힘","disabled":"%{when}에 열림"},"closed":{"enabled":"%{when}에 닫힘","disabled":"%{when}에 열림"},"archived":{"enabled":"%{when} 보관","disabled":"%{when} 보관 취소"},"pinned":{"enabled":"%{when} 고정","disabled":"%{when} 고정 취소"},"pinned_globally":{"enabled":"%{when} 전역적으로 고정","disabled":"%{when} 고정취소"},"visible":{"enabled":"%{when} 목록에 게시","disabled":"%{when} 목록에서 감춤"},"banner":{"enabled":"%{when} 이 내용을 배너로 만드세요 . 사용자가 제거하지 않을 때 까지 배너는 모든 페이지 상단에 노출됩니다.","disabled":"이 배너를 제거했습니다 %{when}. 더 이상 모든 페이지의 상단에 표시되지 않습니다."}},"wizard_required":"새로운 Discourse에 오신것을 환영합니다! \u003ca href='%{url}' data-auto-route='true'\u003e설치 마법사\u003c/a\u003e 로 시작해봅시다✨","emails_are_disabled":"관리자가 이메일 송신을 전체 비활성화 했습니다. 어떤 종류의 이메일 알림도 보내지지 않습니다.","bootstrap_mode_enabled":"쉬운 시작을 위해 부트스트랩 모드로 구동 되었습니다. 모든 새로운 사용자에게 신뢰 수준 1이 부여되고 매일 이메일 다이제스트가 보내집니다. 이 기능은 총 사용자 수가 %{min_users}를 초과 할 때 자동으로 꺼집니다.","bootstrap_mode_disabled":"Bootstrap 모드가 24시간 이내에 해제됩니다.","themes":{"default_description":"기본값","broken_theme_alert":"사이트의 테마 혹은 컴포넌트 (%{theme}) 오류로 정상적으로 작동하지 않을 수 있습니다. %{path}에서 비활성화 해주세요."},"s3":{"regions":{"ap_northeast_1":"아시아 태평양 (토쿄)","ap_northeast_2":"아시아 태평양 (서울)","ap_south_1":"아시아 태평양 (뭄바이)","ap_southeast_1":"아시아 태평양 (싱가폴)","ap_southeast_2":"아시아 태평양 (시드니)","ca_central_1":"캐나다 (중부)","cn_north_1":"중국 (북경)","cn_northwest_1":"중국 (닝샤)","eu_central_1":"유럽연합 (프랑크푸르트)","eu_north_1":"유럽연합 (스톡홀름)","eu_west_1":"유럽연합 (아일랜드)","eu_west_2":"EU (런던)","eu_west_3":"EU (파리)","sa_east_1":"남아메리카 (상파울루)","us_east_1":"미국 동부 (N. 버지니아)","us_east_2":"미국 동부 (오하이오)","us_gov_east_1":"AWS GovCloud (미국 동부)","us_gov_west_1":"AWS GovCloud (미국 서부)","us_west_1":"미국 서부 (N. 캘리포니아)","us_west_2":"미국 서부 (오레곤)"}},"edit":"이 토픽의 제목과 카테고리 편집","expand":"확장","not_implemented":"죄송합니다. 아직 사용할 수 없는 기능입니다.","no_value":"아니오","yes_value":"예","submit":"제출","generic_error":"죄송합니다. 오류가 발생하였습니다.","generic_error_with_reason":"오류가 발생하였습니다: %{error}","go_ahead":"계속","sign_up":"회원가입","log_in":"로그인","age":"나이","joined":"가입함","admin_title":"관리자","show_more":"더 보기","show_help":"옵션","links":"링크","links_lowercase":{"other":"링크"},"faq":"FAQ","guidelines":"가이드라인","privacy_policy":"개인보호 정책","privacy":"개인정보처리방침","tos":"서비스 이용약관","rules":"규칙","conduct":"윤리 강령","mobile_view":"모바일로 보기","desktop_view":"PC로 보기","you":"당신","or":"또는","now":"방금 전","read_more":"더 읽기","more":"더 보기","less":"덜","never":"전혀","every_30_minutes":"매 30분 마다","every_hour":"매 한시간 마다","daily":"매일","weekly":"매주","every_month":"매월","every_six_months":"6개월마다","max_of_count":"최대 {{count}}","alternation":"또는","character_count":{"other":"{{count}} 자"},"related_messages":{"title":"관련 메시지"},"suggested_topics":{"title":"추천 토픽","pm_title":"추천 메세지"},"about":{"simple_title":"소개","title":"소개: %{title}","stats":"사이트 통계","our_admins":"관리자","our_moderators":"운영자","moderators":"운영자","stat":{"all_time":"전체","last_7_days":"최근 7일","last_30_days":"최근 30일"},"like_count":"좋아요","topic_count":"토픽","post_count":"게시글","user_count":"사용자","active_user_count":"활성화된 사용자","contact":"문의","contact_info":"사이트 운영과 관련된 사항이나 요청이 있으시다면 이메일 %{contact_info}로 연락주시기 바랍니다."},"bookmarked":{"title":"북마크","clear_bookmarks":"북마크 제거","help":{"bookmark":"클릭하면 이 토픽의 첫번째 포스트가 북마크됩니다","unbookmark":"클릭하면 이 토픽에 속한 모든 북마크가 제거됩니다"}},"bookmarks":{"created":"이 글을 북마크 했습니다","not_bookmarked":"이 글을 북마크에 추가","remove":"북마크 삭제","confirm_clear":"이 토픽의 모든 북마크를 지우시겠습니까?","save":"저장","reminders":{"later_today":"오늘 늦게","tomorrow":"내일","next_week":"다음 주","later_this_week":"이번 주 후반","next_month":"다음 달"}},"drafts":{"resume":"이력서","remove":"삭제","new_topic":"새로운 토픽 초안","new_private_message":"새로운 비공개 메시지 초안","topic_reply":"임시 답글","abandon":{"confirm":"이 토픽에 이미 열어둔 초안이 있습니다. 기존 초안을 버리길 원하시나요?","yes_value":"예, 버립니다.","no_value":"아니요, 버리지 않습니다."}},"topic_count_latest":{"other":"{{count}}개의 새 토픽이나 업데이트된 토픽"},"topic_count_unread":{"other":"{{count}}개의 읽지 않은 주제"},"topic_count_new":{"other":"{{count}}개의 새로운 토픽 보기"},"preview":"미리보기","cancel":"취소","save":"변경사항 저장","saving":"저장 중...","saved":"저장 완료!","upload":"업로드","uploading":"업로드 중...","uploading_filename":"업르도중: {{filename}}...","clipboard":"클립보드","uploaded":"업로드 완료!","pasting":"붙혀넣는중...","enable":"활성화","disable":"비활성화","continue":"계속","undo":"실행 취소","revert":"되돌리기","failed":"실패","switch_to_anon":"익명 모드 들어가기","switch_from_anon":"익명 모드 나가기","banner":{"close":"배너 닫기","edit":"이 배너 수정 \u003e\u003e"},"choose_topic":{"none_found":"토픽을 찾을 수 없습니다."},"choose_message":{"none_found":"메시지를 찾을 수 없습니다."},"review":{"in_reply_to":"답글","explain":{"total":"총"},"delete":"삭제","settings":{"saved":"저장 완료","save_changes":"변경사항 저장","title":"설정"},"moderation_history":"관리 히스토리","view_all":"모두 보기","none":"검토 할 항목이 없습니다.","view_pending":"보류중 보기","topic_has_pending":{"other":"이 토픽에는 승인 대기중인 게시물이 \u003cb\u003e{{count}}\u003c/b\u003e개 있습니다"},"topic":"토픽:","filtered_topic":"한 토픽에서 검토 가능한 콘텐츠로 필터링 했습니다.","filtered_user":"사용자","show_all_topics":"모든 토픽 보기","user":{"username":"아이디","email":"이메일","name":"이름","fields":"필드"},"user_percentage":{"summary":{"other":"{{agreed}},{{disagreed}},{{ignored}} (전체 {{count}}개의 신고)"},"agreed":{"other":"{{count}}% 동의"},"disagreed":{"other":"{{count}}% 동의안함"},"ignored":{"other":"{{count}}% 무시"}},"topics":{"topic":"토픽","reviewable_count":"수","reported_by":"보고자","details":"상세","unique_users":{"other":"{{count}} 사용자"}},"edit":"수정","save":"저장","cancel":"취소","filters":{"all_categories":"(전체 카테고리)","type":{"title":"형식","all":"(모든 유형)"},"minimum_score":"최소 점수:","refresh":"새로고침","status":"상태","category":"카테고리","priority":{"medium":"중간","high":"높음"}},"conversation":{"view_full":"전체 대화 보기"},"scores":{"score":"점수","date":"날짜","type":"형식","status":"상태","submitted_by":"제출자"},"statuses":{"pending":{"title":"대기중"},"approved":{"title":"승인됨"},"rejected":{"title":"거부됨"},"ignored":{"title":"무시됨"},"deleted":{"title":"삭제됨"}},"types":{"reviewable_flagged_post":{"title":"신고된 글","flagged_by":"신고자"},"reviewable_queued_post":{"title":"대기중인 글"},"reviewable_user":{"title":"사용자"}},"approval":{"title":"게시물 승인 필요","description":"새로운 게시글이 있습니다. 그러나 이 게시글이 보여지려면 운영자의 승인이 필요합니다.","ok":"확인"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e을 게시했습니다","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e회원님\u003c/a\u003e이 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e을 게시했습니다","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e 게시글에 답글 올림","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e 게시글에 답글 올림","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e에 답글을 올렸습니다","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e회원님\u003c/a\u003e이 \u003ca href='{{topicUrl}}'\u003e토픽\u003c/a\u003e에 댓글을 달았습니다","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e를 멘션함","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e님이 \u003ca href='{{user2Url}}'\u003e나\u003c/a\u003e를 멘션함","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e내\u003c/a\u003e가 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e님을 멘션함","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e에 의해 게시됨","posted_by_you":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 게시함","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e님이 보냄","sent_by_you":"\u003ca href='{{userUrl}}'\u003e내\u003c/a\u003e가 보냄"},"directory":{"filter_name":"아이디로 필터","title":"사용자","likes_given":"제공한","likes_received":"받은","topics_entered":"읽음","topics_entered_long":"읽은 토픽 수","time_read":"읽은 시간","topic_count":"토픽","topic_count_long":"생성된 토픽","post_count":"답글","post_count_long":"답글","no_results":"결과가 없습니다.","days_visited":"조회수","days_visited_long":"일일 조회수","posts_read":"읽음","posts_read_long":"게시글 읽음","total_rows":{"other":"%{count} 사용자"}},"group_histories":{"actions":{"change_group_setting":"그룹 설정 변경","add_user_to_group":"사용자 추가","remove_user_from_group":"사용자 삭제","make_user_group_owner":"소유자로 지정하기","remove_user_as_group_owner":"소유자 지정 취소하기"}},"groups":{"member_added":"추가됨","add_members":{"title":"사용자 추가","description":"이 그룹의 회원 관리","usernames":"아이디"},"requests":{"reason":"사유","accept":"승인","accepted":"승인됨","deny":"거부","denied":"거부됨"},"manage":{"title":"관리","name":"이름","full_name":"이름","add_members":"멤버 추가","delete_member_confirm":"'%{username}'님을 '%{group}'그룹에서 삭제 하시겠습니까?","profile":{"title":"프로필"},"interaction":{"posting":"포스팅","notification":"알림"},"membership":{"title":"멤버십","access":"접근"},"logs":{"title":"로그","when":"언제","action":"허용여부","acting_user":"활동하는 사용자","target_user":"타겟 사용자","subject":"제목","details":"세부 내용","from":"보내는사람","to":"받는사람"}},"public_admission":"사용자가 그룹에 자유롭게 가입할 수 있도록 허용합니다. (그룹이 공개되어야 함)","public_exit":"사용자가 그룹을 자유롭게 탈퇴할 수 있도록 허용합니다.","empty":{"posts":"이 그룹에는 아직 멤버들이 포스트를 작성하지 않았습니다.","members":"이 그룹에는 구성원이 없습니다.","mentions":"이 그룹에서는 언급이 없습니다.","messages":"이 그룹에 대한 메시지는 없습니다.","topics":"이 그룹의 멤버가 작성한 토픽이 없습니다.","logs":"이 그룹에 대한 기록이 없습니다."},"add":"추가","leave":"나가기","request":"요청","message":"메시지","membership_request_template":"가입 요청을 전송할 때 사용자에게 표시할 커스텀 템플릿","membership_request":{"submit":"요청 보내기","title":"@%{group_name}에 가입 요청하기","reason":"그룹 소유자에게 왜 이 그룹에 속해야하는지 알립니다."},"membership":"회원제","name":"이름","group_name":"그룹명","user_count":"사용자","bio":"이 그룹에 대하여","selector_placeholder":"아이디 입력","owner":"소유자","index":{"title":"그룹","all":"모든 그룹","empty":"보이는 그룹이 없습니다.","filter":"그룹 유형별로 분류","close_groups":"닫힌 그룹","automatic_groups":"자동 그룹","automatic":"자동","closed":"닫힘","public":"공개","private":"비공개","automatic_group":"자동 그룹","my_groups":"내 그룹","is_group_user":"준회원"},"title":{"other":"그룹"},"activity":"활동","members":{"title":"멤버","filter_placeholder_admin":"아이디 혹은 이메일","filter_placeholder":"아이디","remove_member":"회원 삭제","remove_member_description":"이 그룹에서 \u003cb\u003e%{username}\u003c/b\u003e(을)를 삭제합니다.","make_owner_description":"이 그룹에서 \u003cb\u003e%{username}\u003c/b\u003e(을)를 소유자로 설정합니다."},"topics":"토픽","posts":"게시글","mentions":"멘션","messages":"메시지","notification_level":"그룹 메시지의 기본 알림 레벨","alias_levels":{"mentionable":"누가 이 그룹에 @멘션을 할 수 있나요?","messageable":"누가 이 그룹에 메시지를 보낼 수 있나요?","nobody":"0명","only_admins":"관리자 전용","mods_and_admins":"운영자 및 관리자만","members_mods_and_admins":"그룹 멤버, 운영자, 관리자만","everyone":"모두"},"notifications":{"watching":{"title":"알림 : 주시 중","description":"이 메시지에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"watching_first_post":{"title":"첫번째 글 보기"},"tracking":{"title":"추적 중","description":"누군가 당신의 @아이디 로 언급했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"regular":{"title":"알림 : 일반","description":"누군가 당신의 @아이디 로 언급했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted":{"title":"알림 : 끔"}},"flair_url":"아바타 플레어 이미지","flair_url_placeholder":"(선택) 이미지 URL 또는 Font Awesome 아이콘 클래스","flair_bg_color":"아바타 플레어 배경 색상","flair_bg_color_placeholder":"(선택사항) 16진수 컬러 값","flair_color":"아바타 플레어 색상","flair_color_placeholder":"(선택사항) 16진수 컬러 값","flair_preview_icon":"미리보기 아이콘","flair_preview_image":"미리보기 이미지"},"user_action_groups":{"1":"선사한 '좋아요'","2":"받은 '좋아요'","3":"북마크","4":"토픽","5":"답글","6":"응답","7":"멘션","9":"인용","11":"편집","12":"보낸 편지함","13":"받은 편지함","14":"대기"},"categories":{"all":"전체 카테고리","all_subcategories":"모두","no_subcategory":"없음","category":"카테고리","category_list":"카테고리 목록 표시","reorder":{"title":"카테고리 순서변경","title_long":"카테고리 목록 재구성","save":"순서 저장","apply_all":"적용","position":"위치"},"posts":"게시글","topics":"토픽","latest":"최근","latest_by":"가장 최근","toggle_ordering":"정렬 컨트롤 토글","subcategories":"하위 카테고리","topic_sentence":{"other":"%{count}개의 토픽"}},"ip_lookup":{"title":"IP 주소 Lookup","hostname":"Hostname","location":"위치","location_not_found":"(알수없음)","organisation":"소속","phone":"전화","other_accounts":"현재 IP주소의 다른 계정들:","delete_other_accounts":"삭제 %{count}","username":"아이디","trust_level":"TL","read_time":"읽은 시간","topics_entered":"입력된 제목:","post_count":"포스트 개수","confirm_delete_other_accounts":"정말 이 계정들을 삭제하시겠습니까?","copied":"복사됨"},"user_fields":{"none":"(옵션을 선택하세요)"},"user":{"said":"{{username}}:","profile":"프로필","mute":"알림 끄기","edit":"환경 설정 편집","download_archive":{"button_text":"모두 다운로드하기","confirm":"정말로 작성한 모든 글을 다운로드할까요?","success":"다운로드가 시작되었습니다. 다운로드 과정이 완료되면 메시지로 알려드리겠습니다.","rate_limit_error":"게시글은 하루에 한번만 다운로드할 수 있습니다. 내일 다시 시도해보세요."},"new_private_message":"새로운 메시지","private_message":"메시지","private_messages":"메시지","user_notifications":{"ignore_duration_username":"아이디","ignore_duration_save":"무시","ignore_option":"무시됨","mute_option":"알림끔","normal_option":"알림 : 일반"},"activity_stream":"활동","preferences":"환경 설정","feature_topic_on_profile":{"save":"저장","clear":{"title":"Clear"}},"profile_hidden":"이 사용자의 프로필은 비공개 상태입니다.","expand_profile":"확장","bookmarks":"북마크","bio":"내 소개","timezone":"시간대","invited_by":"(이)가 초대했습니다.","trust_level":"신뢰도","notifications":"알림","statistics":"통계","desktop_notifications":{"label":"실시간 알림","not_supported":"안타깝게도 지금 사용하고 계시는 브라우저는 알림을 지원하지 않습니다.","perm_default":"알림 켜기","perm_denied_btn":"권한 거부","perm_denied_expl":"알림을 허가하지 않으셨군요. 브라우저 설정을 통해서 알림을 허용해주세요.","disable":"알림 비활성화","enable":"알림 활성화","each_browser_note":"노트: 사용하시는 모든 브라우저에서 이 설정을 변경해야합니다.","consent_prompt":"포스트에 댓글이 달렸을때 실시간 알림을 받겠습니까?"},"dismiss":"해지","dismiss_notifications":"모두 해지","dismiss_notifications_tooltip":"읽지 않은 알림을 모두 읽음으로 표시","first_notification":"당신의 첫 번째 알림입니다! 시작하려면 선택해보세요.","allow_private_messages":"다른 사용자가 나에게 개인 메시지를 보내는것을 허용","external_links_in_new_tab":"모든 외부 링크를 새 탭에 열기","enable_quoting":"강조 표시된 텍스트에 대한 알림을 사용합니다","change":"변경","moderator":"{{user}}님은 운영자입니다","admin":"{{user}}님은 관리자 입니다","moderator_tooltip":"이 회원은 운영자 입니다","admin_tooltip":"이 회원은 관리자입니다.","silenced_tooltip":"이 회원은 차단되었습니다","suspended_notice":"이 회원은 {{date}}까지 접근 금지 되었습니다.","suspended_permanently":"이 회원은 일시정지되었습니다.","suspended_reason":"사유: ","github_profile":"Github","email_activity_summary":"활동 요약","mailing_list_mode":{"label":"메일링 리스트 모드","enabled":"메일링 리스트 모드 활성화","instructions":"\n이 설정은 활동 요약을 무시합니다.\u003cbr /\u003e\n\n알림이 꺼진 토픽과 카테고리는 이 이메일에 포함되지 않습니다.\n","individual":"모든 새로운 게시글에 대해 메일을 보내주세요.","individual_no_echo":"내가 쓴 것만 제외하고 모든 게시글에 대해 이메일을 보내주세요","many_per_day":"모든 새 게시글에 대해 이메일을 보내주세요 (일일 약 {{dailyEmailEstimate}}개)","few_per_day":"모든 새로운 게시글에 대해 메일을 보내주세요 (하루에 약 2개)."},"tag_settings":"태그","watched_tags":"지켜보기","watched_tags_instructions":"이 태그가 붙은 토픽들을 주시하도록 자동으로 설정됩니다. 새로운 게시글이나 토픽에 대하여 알림을 받게되며 토픽 옆에 새로운 게시글의 수가 표시됩니다.","tracked_tags":"추적하기","tracked_tags_instructions":"이 태그가 붙은 모든 토픽을 추적하도록 자동설정됩니다. 새로운 게시글의 수가 토픽 옆에 표시됩니다.","muted_tags":"알람 끄기","muted_tags_instructions":"이 태그가 달린 토픽에 대해 알림을 받지 않으며, 최근 토픽란에도 나타나지 않습니다.","watched_categories":"지켜보기","watched_categories_instructions":"이 카테고리의 모든 토픽을 주시하도록 자동 설정됩니다. 새로운 게시글이나 토픽에 대하여 알림을 받게 되며, 토픽 옆에 새로운 게시글의 수가 표시됩니다.","tracked_categories":"추적하기","tracked_categories_instructions":"이 카테고리의 모든 토픽을 추적하도록 자동설정됩니다. 새로운 게시글의 수가 토픽 옆에 표시됩니다.","watched_first_post_categories":"첫번째 글 보기","watched_first_post_categories_instructions":"이 카테고리에 새로운 토픽이 생길 때마다 알림을 받습니다.","watched_first_post_tags":"첫번째 글 보기","watched_first_post_tags_instructions":"이 태그가 달린 토픽이 생길 때마다 알림을 받습니다.","muted_categories":"알림 끄기","no_category_access":"운영자는 이 카테고리 접근에 제약을 받습니다. 저장이 해제 됩니다.","delete_account":"내 계정 삭제","delete_account_confirm":"정말로 계정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.","deleted_yourself":"계정이 삭제 되었습니다.","unread_message_count":"메시지","admin_delete":"삭제","users":"회원","muted_users":"알람 끄기","muted_users_instructions":"이 회원이 보낸 알림 모두 숨김","ignored_users":"무시됨","tracked_topics_link":"보이기","automatically_unpin_topics":"글 끝에 다다르면 자동으로 토픽 고정을 해제합니다.","apps":"앱","revoke_access":"접근권한 회수","undo_revoke_access":"접근권환 회수 취소","api_approved":"승인됨:","theme":"테마","home":"기본 홈페이지","staged":"격리됨","staff_counters":{"flags_given":"유용한 신고","flagged_posts":"신고된 글","deleted_posts":"삭제된 글","suspensions":"정지시킨 계정","warnings_received":"경고"},"messages":{"all":"전체","inbox":"수신함","sent":"보냄","archive":"저장됨","groups":"내 그룹","bulk_select":"메시지 선택","move_to_inbox":"수신함으로 이동","move_to_archive":"보관하기","failed_to_move":"선택한 메시지를 이동할 수 없습니다 (아마도 네트워크가 다운됨)","select_all":"모두 선택","tags":"태그"},"preferences_nav":{"account":"계정","profile":"프로필","emails":"이메일","notifications":"알림","categories":"카테고리","users":"사용자","tags":"태그","interface":"인터페이스","apps":"앱"},"change_password":{"success":"(이메일 전송)","in_progress":"(이메일 전송 중)","error":"(오류)","action":"비밀번호 재설정 메일 보내기","set_password":"비밀번호 설정","choose_new":"새로운 비밀번호를 적어주세요","choose":"비밀번호를 적어주세요"},"second_factor_backup":{"regenerate":"재생성","disable":"해제","enable":"설정","enable_long":"백업 코드 사용","copied_to_clipboard":"클립보드에 복사됨","copy_to_clipboard_error":"데이터를 클립보드에 복사하는데 오류가 발생했습니다.","codes":{"title":"백업 코드가 재생성됨"}},"second_factor":{"title":"이중 인증","confirm_password_description":"비밀번호를 확인해주세요.","name":"이름","label":"코드","edit":"수정","security_key":{"register":"등록하기","delete":"삭제"}},"change_about":{"title":"내 소개 변경","error":"값을 바꾸는 중 에러가 발생했습니다."},"change_username":{"title":"아이디 변경","confirm":"정말로 아이디를 변경 하시겠습니까?","taken":"죄송합니다. 이미 사용 중인 아이디입니다.","invalid":"아이디가 잘못되었습니다. 숫자와 문자를 포함해야합니다."},"change_email":{"title":"이메일 변경","taken":"죄송합니다. 해당 이메일은 사용 할 수 없습니다.","error":"이메일 변경 중 오류가 발생했습니다. 이미 사용 중인 이메일인지 확인해주세요.","success":"이메일 발송이 완료되었습니다. 확인하신 후 절차에 따라주세요.","success_staff":"현재 주소로 이메일을 보냈습니다. 확인 절차에 따라 진행해 주세요."},"change_avatar":{"title":"프로필 사진 변경","letter_based":"자동 생성된 아바타","uploaded_avatar":"커스텀 사진","uploaded_avatar_empty":"커스텀 사진 추가","upload_title":"프로필 사진 업로드","image_is_not_a_square":"경고: 정사각형 이미지가 아니기 때문에 사진을 수정하였습니다."},"change_card_background":{"title":"사용자 카드 배경","instructions":"배경 이미지는 가운데를 기준으로 표시되며 590px이 기본 가로 사이즈 입니다."},"email":{"title":"이메일","primary":"기본 이메일","secondary":"보조 이메일","no_secondary":"보조 이메일이 없습니다","instructions":"절대로 공개되지 않습니다.","ok":"내 이메일로 확인 메일이 전송됩니다.","invalid":"유효한 이메일 주소를 입력해주세요.","authenticated":"내 이메일이 {{provider}}에 의해 인증되었습니다.","frequency_immediately":"만약 전송된 메일을 읽지 않았을 경우, 즉시 메일을 다시 보내드립니다.","frequency":{"other":"최근 {{count}}분 동안접속하지 않을 경우에만 메일이 전송됩니다."}},"associated_accounts":{"connect":"연결","revoke":"회수","cancel":"취소","not_connected":"(연결되지 않음)"},"name":{"title":"이름","instructions":"이름 (선택사항)","instructions_required":"이름","too_short":"이름이 너무 짧습니다.","ok":"사용 가능한 이름입니다."},"username":{"title":"아이디","instructions":"공백없이, 짧고 특이하게","short_instructions":"@{{username}}으로 멘션이 가능합니다.","available":"아이디로 사용가능합니다.","not_available":"사용할 수 없는 아이디입니다. 다시 시도해보세요. {{suggestion}}","not_available_no_suggestion":"불가합니다","too_short":"아이디가 너무 짧습니다","too_long":"아이디가 너무 깁니다.","checking":"사용가능한지 확인 중...","prefilled":"이메일이 등록된 아이디와 연결되어 있습니다."},"locale":{"title":"인터페이스 언어","instructions":"UI 언어. 변경 후 새로 고침하면 반영됩니다.","default":"(기본)","any":"무관"},"password_confirmation":{"title":"비밀번호를 재입력해주세요."},"auth_tokens":{"title":"최근에 사용한 기기","ip":"IP","details":"세부 내용","log_out_all":"모두 로그 아웃","not_you":"사용자님이 아닌가요?"},"last_posted":"마지막글","last_emailed":"마지막 이메일","last_seen":"마지막 접속","created":"생성일","log_out":"로그아웃","location":"위치","website":"웹사이트","email_settings":"이메일","hide_profile_and_presence":"내 공개 프로필 및 현재 상태 기능 숨기기","text_size":{"normal":"알림 : 일반"},"like_notification_frequency":{"title":"좋아요를 받았을 때 알림받기","always":"항상 알림받기","first_time_and_daily":"포스트가 첫 좋아요를 받았을 때부터 매일 알림받기","first_time":"포스트가 첫 좋아요를 받았을 때 알림받기","never":"알림 받지 않기"},"email_previous_replies":{"title":"이메일 하단에 예전에 읽은 댓글도 포함하기","unless_emailed":"확인하지 않은 댓글만 포함하기","always":"항상 알림 받기","never":"알림 받지 않기"},"email_digests":{"every_30_minutes":"매 30분 마다","every_hour":"매 시간","daily":"매일","weekly":"매주","every_month":"매월","every_six_months":"6개월마다"},"email_level":{"title":"인용, 댓글, @아이디 멘션, 토픽 초대를 받을 때 이메일 받기","always":"항상 알림 받기","never":"하지않음"},"email_messages_level":"메시지가 왔을 때 이메일 받기","include_tl0_in_digests":"신규 사용자가 작성한 내용도 요약 메일에 포함시키기","email_in_reply_to":"이메일에 댓글 내용을 발췌해서 포함","other_settings":"추가 사항","categories_settings":"카테고리","new_topic_duration":{"label":"아래 조건에 해당하면 새로운 토픽으로 간주","not_viewed":"아직 읽지 않은 토픽","last_here":"마지막 방문이후 작성된 토픽","after_1_day":"지난 하루간 생성된 토픽","after_2_days":"지난 2일간 생성된 토픽","after_1_week":"최근 일주일간 생성된 토픽","after_2_weeks":"지난 2주간 생성된 토픽"},"auto_track_topics":"내가 들어간 토픽 자동으로 추적","auto_track_options":{"never":"하지않음","immediately":"즉시","after_30_seconds":"30초 후","after_1_minute":"1분 후","after_2_minutes":"2분 후","after_3_minutes":"3분 후","after_4_minutes":"4분 후","after_5_minutes":"5분 후","after_10_minutes":"10분 후"},"notification_level_when_replying":"토픽에 포스트를 쓰면 그 토픽을 다음으로 설정","invited":{"search":"검색","title":"초대","user":"사용자 초대","truncated":{"other":"앞 {{count}}개의 초대를 보여줍니다."},"redeemed":"초대를 받았습니다.","redeemed_tab":"Redeemed","redeemed_tab_with_count":"교환된 ({{count}})","redeemed_at":"에 초대되었습니다.","pending":"초대를 보류합니다.","pending_tab":"보류","pending_tab_with_count":"지연 ({{count}})","topics_entered":"읽은 토픽","posts_read_count":"글 읽기","expired":"이 초대장의 기한이 만료되었습니다.","rescind":"삭제","rescinded":"초대가 제거되었습니다.","reinvite":"초대 메일 재전송","reinvite_all":"모든 초대장 다시 보내기","reinvite_all_confirm":"정말로 모든 초대장을 다시 보낼까요?","reinvited":"초대 메일 재전송 됨","reinvited_all":"모든 초대장이 다시 발송되었습니다!","time_read":"읽은 시간","days_visited":"일일 방문","account_age_days":"일일 계정 나이","create":"이 포럼에 친구를 초대하기","generate_link":"초대 링크 복사","link_generated":"초대 링크가 성공적으로 생성되었습니다!","valid_for":"이 초대링크는 이메일 주소 '%{email}'에 한해서만 유효합니다.","bulk_invite":{"none":"아직 아무도 초대하지 않으셨어요. 한 명씩 초대장을 보내거나, \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eCSV 파일을 업로드\u003c/a\u003e해서 여러 사람에게 한꺼번에 초대장을 보낼 수 있습니다.","text":"파일로 대량 초대하기","success":"파일이 성공적으로 업로드되었습니다. 완료되면 메시지로 알려드리겠습니다.","error":"죄송합니다. CSV형식의 파일만 올릴 수 있습니다."}},"password":{"title":"비밀번호","too_short":"암호가 너무 짧습니다.","common":"That password is too common.","same_as_username":"비밀번호가 아이디와 동일합니다.","same_as_email":"비밀번호가 이메일과 동일합니다.","ok":"적절한 암호입니다.","instructions":"최소 %{count} 자"},"summary":{"title":"요약","stats":"통계","time_read":"읽은 시간","recent_time_read":"최근 읽은 시간","topic_count":{"other":"작성 시간"},"post_count":{"other":"작성 시간"},"likes_given":{"other":"누름"},"likes_received":{"other":"받음"},"days_visited":{"other":"방문일수"},"topics_entered":{"other":"토픽이 표시됨"},"posts_read":{"other":"읽은 글 갯수"},"bookmark_count":{"other":"북마크들"},"top_replies":"인기 댓글","no_replies":"아직 답글이 없습니다.","more_replies":"답글 더 보기","top_topics":"인기 토픽","no_topics":"아직 주제가 없습니다.","more_topics":"주제 더 보기","top_badges":"인기 배지","no_badges":"아직 배지가 없습니다.","more_badges":"배지 더 보기","top_links":"인기 링크","no_links":"아직 링크가 없습니다.","most_liked_by":"가장 많이 좋아요를 한 사용자","most_liked_users":"가장 많이 좋아요를 받은","most_replied_to_users":"댓글을 가장 많이 단 사람","no_likes":"아직 좋아요가 없습니다.","top_categories":"상위 카테고리","topics":"주제글","replies":"댓글"},"ip_address":{"title":"마지막 IP 주소"},"registration_ip_address":{"title":"IP Address 등록"},"avatar":{"title":"프로필 사진","header_title":"프로필, 메시지, 북마크 그리고 설정"},"title":{"title":"호칭","none":"(없음)"},"primary_group":{"title":"주 그룹","none":"(없음)"},"filters":{"all":"전체"},"stream":{"posted_by":"에 의해 작성되었습니다","sent_by":"에 의해 전송되었습니다","private_message":"메시지","the_topic":"주제"}},"loading":"로딩 중...","errors":{"prev_page":"로드하는 중","reasons":{"network":"네트워크 에러","server":"서버 에러","forbidden":"접근 거부됨","unknown":"에러","not_found":"페이지를 찾을 수 없습니다"},"desc":{"network":"접속상태를 확인해주세요.","network_fixed":"문제가 해결된 것으로 보입니다.","server":"에러 코드: {{status}}","forbidden":"볼 수 있도록 허용되지 않았습니다.","not_found":"에구, 어플리케이션이 없는 URL를 가져오려고 시도했습니다.","unknown":"문제가 발생했습니다."},"buttons":{"back":"뒤로가기","again":"다시시도","fixed":"페이지 열기"}},"modal":{"close":"닫기"},"close":"닫기","assets_changed_confirm":"사이트가 업데이트 되었습니다. 새로고침하시겠습니까?","logout":"로그아웃 되었습니다.","refresh":"새로고침","read_only_mode":{"enabled":"이 사이트는 현재 읽기전용 모드입니다. 브라우징은 가능하지만, 댓글달기, 좋아요 등 다른 행위들은 현재 비활성화 되어있습니다.","login_disabled":"사이트가 읽기 전용모드로 되면서 로그인은 비활성화되었습니다.","logout_disabled":"사이트가 읽기 전용모드일 때 로그아웃은 비활성화됩니다."},"learn_more":"더 배우기","all_time":"총","all_time_desc":"총 토픽","year":"년","year_desc":"지난 365일간 생성된 주제","month":"월","month_desc":"지난 30일간 생성된 주제","week":"주","week_desc":"지난 7일간 생성된 주제","day":"일","first_post":"첫 번째 글","mute":"음소거","unmute":"음소거 해제","last_post":"게시날짜","time_read":"읽음","last_reply_lowercase":"마지막 답글","replies_lowercase":{"other":"답글"},"signup_cta":{"sign_up":"회원가입","hide_session":"내일 다시 알려주기","hide_forever":"사양합니다.","hidden_for_session":"알겠습니다. 내일 다시 물어볼께요. 언제든지 '로그인'을 통해서도 계정을 만들 수 있습니다."},"summary":{"enabled_description":"현재 커뮤니티에서 가장 인기있는 주제의 요약본을 보고 있습니다:","description":"댓글이 \u003cb\u003e{{replyCount}}개\u003c/b\u003e 있습니다.","description_time":"댓글이 \u003cb\u003e{{replyCount}}개\u003c/b\u003e 있고 다 읽는데 \u003cb\u003e{{readingTime}} 분\u003c/b\u003e이 걸립니다.","enable":"이 주제를 요약","disable":"모든 포스트 보기"},"deleted_filter":{"enabled_description":"이 주제는 삭제된 글들을 포함하고 있습니다. 삭제된 글을 보이지 않습니다.","disabled_description":"삭제된 글들을 표시하고 있습니다.","enable":"삭제된 글 숨김","disable":"삭제된 글 보기"},"private_message_info":{"title":"메시지","edit":"추가 또는 삭제 ...","leave_message":"정말로 이 메시지를 남길까요?","remove_allowed_user":"{{name}}에게서 온 메시지를 삭제할까요?","remove_allowed_group":"{{name}}에게서 온 메시지를 삭제할까요?"},"email":"이메일","username":"아이디","last_seen":"마지막 접속","created":"생성","created_lowercase":"최초 글","trust_level":"회원등급","search_hint":"아이디, 이메일 혹은 IP 주소","create_account":{"title":"회원 가입","failed":"뭔가 잘못되었습니다. 이 메일은 등록이 되어있습니다. 비밀번호를 잊으셨다면 비밀번호 찾기를 눌러주세요."},"forgot_password":{"title":"비밀번호 재설정","action":"비밀번호를 잊어버렸습니다.","invite":"사용자 이름 또는 이메일 주소를 입력하시면 비밀번호 재설정 이메일을 보내드립니다.","reset":"암호 재설정","complete_username":"자신의 아이디가 \u003cb\u003e%{username}\u003c/b\u003e이라면, 곧 비밀번호 초기화 방법과 관련된 안내 메일을 받게 됩니다.","complete_email":"만약 계정이 \u003cb\u003e%{email}\u003c/b\u003e과 일치한다면, 비밀번호를 재설정하는 방법에 대한 이메일을 곧 받게 됩니다.","complete_username_not_found":"\u003cb\u003e%{username}\u003c/b\u003e과 일치하는 계정이 없습니다.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e과 일치하는 계정이 없습니다.","help":"이메일을 못받으셨나요? 일단 스팸 폴더부터 체크해보세요.\u003cp\u003e어떤 이메일 주소를 입력했는지 확실치 않나요? 이메일 주소를 여기에 입력하시면 기록이 있는지 봐드리겠습니다.\u003c/p\u003e\u003cp\u003e만약 더 이상 그 이메일 주소로 접근할 수 없다면, \u003ca href='%{basePath}/about'\u003e친절한 운영진\u003c/a\u003e에게 도움을 요청하세요.\u003c/p\u003e","button_ok":"확인","button_help":"도움말"},"email_login":{"complete_username_not_found":"\u003cb\u003e%{username}\u003c/b\u003e과 일치하는 계정이 없습니다.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e과 일치하는 계정이 없습니다.","confirm_title":"%{site_name}으로 가기"},"login":{"title":"로그인","username":"아이디","password":"비밀번호","second_factor_title":"이중 인증","second_factor_backup_description":"백업 코드 중 하나를 입력하세요:","email_placeholder":"이메일 주소 또는 아이디","caps_lock_warning":"Caps Lock 켜짐","error":"알 수없는 오류","rate_limit":"다시 로그인 하기전에 잠시만 기다려주세요.","blank_username_or_password":"이메일 또는 아이디, 비밀번호를 입력해 주세요.","reset_password":"암호 재설정","logging_in":"로그인 중..","or":"또는","authenticating":"인증 중...","awaiting_activation":"계정이 아직 미활성 상태입니다. 활성화 메일을 보내려면 비밀번호 찾기 링크를 사용하세요.","awaiting_approval":"스태프가 아직 내 계정을 승인하지 않았습니다. 승인되면 이메일을 받게됩니다.","requires_invite":"죄송합니다. 초대를 받은 사람만 이용하실 수 있습니다.","not_activated":"아직 로그인 할 수 없습니다. 계정을 만들었을때 \u003cb\u003e {{sentTo}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 계정을 활성화하려면 해당 이메일의 지침을 따르십시오.","not_allowed_from_ip_address":"이 IP 주소에서 로그인 할 수 없습니다.","admin_not_allowed_from_ip_address":"You can't log in as admin from that IP address.","resend_activation_email":"다시 인증 이메일을 보내려면 여기를 클릭하세요.","resend_title":"활성화 이메일 다시 보내기","change_email":"이메일 주소 변경","provide_new_email":"새로운 주소를 적어주시면 확인 메일을 재전송해드리겠습니다.","submit_new_email":"이메일 주소 변경","sent_activation_email_again":"\u003cb\u003e {{currentEmail}} \u003c/b\u003e 주소로 인증 이메일을 보냈습니다. 이메일이 도착하기까지 몇 분 정도 걸릴 수 있습니다. 또한 스팸 메일을 확인하십시오.","to_continue":"로그인 해주세요","preferences":"사용자 환경을 변경하려면 로그인이 필요합니다.","forgot":"내 계정의 상세내역 기억하지 않는다.","not_approved":"당신의 계정은 아직 활성화되지 않았습니다. 이메일을 확인하시고 로그인 해주세요.","google_oauth2":{"name":"구글","title":"with Google"},"twitter":{"name":"트위터","title":"with Twitter"},"instagram":{"name":"인스타그램","title":"인스타그램"},"facebook":{"name":"페이스북","title":"with Facebook"},"github":{"name":"GitHub","title":"GitHub"},"second_factor_toggle":{"backup_code":"대신 백업 코드 사용"}},"invites":{"accept_title":"초대장","welcome_to":"%{site_name}에 오신것을 환영합니다.","invited_by":"당신을 초청한 사람:","social_login_available":"해당 이메일 주소를 사용하는 다른 소셜 로그인으로 접속하는 것도 가능합니다.","your_email":"당신의 계정 이메일은 \u003cb\u003e%{email}\u003c/b\u003e입니다.","accept_invite":"초청 수락하기","success":"계정 생성이 생성되었습니다. 현재 로그인 상태입니다.","name_label":"이름","password_label":"비밀번호 설정","optional_description":"(선택사항)"},"password_reset":{"continue":"%{site_name}으로 가기"},"emoji_set":{"apple_international":"Apple/International","google":"구글","twitter":"트위터","win10":"Win10","google_classic":"Google 클래식","facebook_messenger":"Facebook 메신저"},"category_page_style":{"categories_only":"카테고리만","categories_with_featured_topics":"주요 토픽이 있는 카테고리","categories_and_latest_topics":"카테고리와 최신 토픽"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"로드중..."},"select_kit":{"default_header_text":"선택...","no_content":"일치하는 결과가 없습니다","filter_placeholder":"검색..."},"date_time_picker":{"from":"보내는사람","to":"받는사람"},"emoji_picker":{"filter_placeholder":"이모지 찾기","objects":"사물","flags":"신고들","recent":"최근 사용","default_tone":"피부색 없음","light_tone":"밝은 피부색","medium_light_tone":"약간 밝은 피부색","medium_tone":"중간 피부색","medium_dark_tone":"약간 어두운 피부색","dark_tone":"어두운 피부색","default":"커스텀 emoji"},"composer":{"emoji":"이모지 :)","more_emoji":"더보기...","options":"옵션","whisper":"귓속말","unlist":"목록에서 제외됨","blockquote_text":"Blockquote","add_warning":"공식적인 경고입니다.","toggle_whisper":"귀속말 켜고 끄기","toggle_unlisted":"목록제외 켜고 끄기","posting_not_on_topic":"어떤 주제에 답글을 작성하시겠습니까?","saved_local_draft_tip":"로컬로 저장됩니다.","similar_topics":"작성하려는 내용과 비슷한 주제들...","drafts_offline":"초안","group_mentioned":{"other":"{{group}}을 언급하면, \u003ca href='{{group_link}}'\u003e{{count}} 명\u003c/a\u003e의 회원에게 알림이 갑니다. 그렇게 할까요?"},"cannot_see_mention":{"category":"{{username}}에게 멘션을 썼지만, 해당 사용자가 이 카테고리에 접근할 수 없기 때문에 알림이 가지 않습니다. 이 카테고리에 접근할 수 있는 그룹에 해당 멤버가 추가되어야 합니다.","private":"{{username}}에게 멘션을 썼지만, 해당 사용자가 개인 메시지를 볼 수 없기 때문에 알림이 가지 않습니다. 이 개인 메시지에 해당 사용자를 초대해야 합니다."},"duplicate_link":"이 토픽에는 이미\u003cb\u003e{{domain}}\u003c/b\u003e의 링크가 \u003cb\u003e@{{username}}\u003c/b\u003e님이 \u003ca href='{{post_url}}'\u003e{{ago}}\u003c/a\u003e전에 쓴 게시글에 게시되어 있습니다. 그래도 다시 게시할까요?","error":{"title_missing":"제목은 필수 항목입니다","title_too_short":"제목은 최소 {{min}} 글자 이상이어야 합니다.","title_too_long":"제목은 {{max}} 글자 이상일 수 없습니다.","post_length":"글은 최소 {{min}} 글자 이상이어야 합니다.","category_missing":"카테고리를 선택해주세요."},"save_edit":"편집 저장","reply_original":"기존 주제에 대해 답글을 작성합니다.","reply_here":"여기에 답글을 작성하세요.","reply":"답글 전송","cancel":"취소","create_topic":"새 주제 쓰기","create_pm":"메시지","title":"혹은 Ctrl + Enter 누름","users_placeholder":"사용자 추가","title_placeholder":"이야기 나누고자 하는 내용을 한문장으로 적는다면?","title_or_link_placeholder":"제목을 입력하거나, 링크를 붙여넣으세요","edit_reason_placeholder":"why are you editing?","topic_featured_link_placeholder":"타이틀과 함께 표시될 링크를 입력하세요.","reply_placeholder":"여기에 타이핑 하세요. 마크다운 또는 BBCode, HTML 포맷을 이용하세요. 이미지를 끌어오거나 붙여넣기 하세요.","view_new_post":"새로운 글을 볼 수 있습니다.","saving":"저장 중...","saved":"저장 완료!","uploading":"업로딩 중...","show_preview":"미리보기를 보여줍니다 \u0026laquo;","hide_preview":"\u0026laquo; 미리보기를 숨기기","quote_post_title":"전체 글을 인용","bold_label":"B","bold_title":"굵게","bold_text":"굵게하기","italic_label":"I","italic_title":"강조","italic_text":"강조하기","link_title":"하이퍼링크","link_description":"링크 설명을 입력","link_dialog_title":"하이퍼링크 삽입","link_optional_text":"옵션 제목","quote_title":"인용구","quote_text":"인용구","code_title":"코드 샘플","code_text":"미리 지정된 양식 사용은 4개의 띄어쓰기로 들여쓰세요.","paste_code_text":"여기에 코드를 붙여넣거나 입력하세요","upload_title":"업로드","upload_description":"업로드 설명을 입력","olist_title":"번호 매기기 목록","ulist_title":"글 머리 기호 목록","list_item":"주제","help":"마크다운 편집 도움말","modal_ok":"확인","modal_cancel":"취소","cant_send_pm":"죄송합니다. %{username}님에게 메시지를 보낼 수 없습니다.","yourself_confirm":{"title":"수신자 추가를 잊으셨나요?","body":"현재 이 메시지는 당신에게만 전송됩니다."},"admin_options_title":"이 주제에 대한 옵션 설정","composer_actions":{"reply":"댓글","draft":"임시저장","edit":"수정","reply_as_private_message":{"label":"새 메시지","desc":"새 개인 메시지 쓰기"},"create_topic":{"label":"새 주제글"}},"details_title":"요약","details_text":"이 텍스트는 숨겨집니다."},"notifications":{"tooltip":{"regular":{"other":"{{count}}개의 확인하지 않은 알림이 있습니다"},"message":{"other":"{{count}}개의 읽지않은 메시지가 있습니다"}},"title":"@name 언급, 글과 주제에 대한 답글, 개인 메시지 등에 대한 알림","none":"현재 알림을 불러올 수 없습니다.","empty":"알림이 없습니다.","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}} ","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}} ","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"other":"\u003cspan\u003e{{username}}, {{username2}} 외 {{count}} 명의 사용자가\u003c/span\u003e {{description}}"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}} ","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e 님이 초대를 수락했습니다","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e 님이 {{description}} (을)를 이동했습니다","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"'{{description}}' 를 받았습니다","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003e새 토픽\u003c/span\u003e {{description}}","group_message_summary":{"other":" {{group_name}} 사서함에 {{count}} 개의 메시지가 있습니다"},"popup":{"mentioned":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 나를 멘션했습니다","group_mentioned":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 당신을 언급했습니다","quoted":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 나를 인용했습니다","replied":"\"{{topic}}\" - {{site_title}}에서 {{username}} 님이 내게 답글을 달았습니다","posted":"\"{{topic}}\" - {{site_title}}에서 {{username}}님이 글을 게시하였습니다","linked":"{{username}}님이 \"{{topic}}\" - {{site_title}}에 내 글을 링크했습니다","confirm_title":"알림 활성 - %{site_title}","confirm_body":"완료! 알림이 활성화되었습니다."},"titles":{"watching_first_post":"새로운 주제","post_approved":"게시물 승인됨"}},"upload_selector":{"title":"이미지 추가하기","title_with_attachments":"이미지 또는 파일 추가하기","from_my_computer":"컴퓨터에서 가져오기","from_the_web":"인터넷에서 가져오기","remote_tip":"이미지 링크","remote_tip_with_attachments":"이미니자 파일 링크 {{authorized_extensions}}","local_tip":"기기에서 이미지 선택","local_tip_with_attachments":"디바이스에서 이미지나 파일을 선택하세요 {{authorized_extensions}}","hint":"(드래그\u0026드랍으로 업로드 가능)","hint_for_supported_browsers":"편집창에 이미지를 끌어다 놓거나 붙여넣기 할 수도 있습니다","uploading":"업로드 중입니다...","select_file":"파일 선택","default_image_alt_text":"이미지"},"search":{"sort_by":"다음으로 정렬","relevance":"관련성","latest_post":"가장 최근 글","latest_topic":"최신 토픽","most_viewed":"가장 많이 본","most_liked":"가장 많이 좋아요를 받은","select_all":"모두 선택","clear_all":"다 지우기","too_short":"검색 단어가 너무 짧습니다.","title":"주제, 글, 사용자, 카테고리 검색","full_page_title":"주제글 또는 글 검색","no_results":"검색 결과가 없습니다","no_more_results":"더 이상 결과가 없습니다.","searching":"검색중...","post_format":"#{{post_number}} by {{username}}","results_page":"'{{term}}'의 검색 결과","more_results":"검색 결과가 많습니다. 검색 조건을 좁혀보세요.","cant_find":"원하는 걸 찾을 수 없으신가요?","start_new_topic":"새 토픽을 만들어볼까요?","or_search_google":"혹은 구글에서 검색해볼 수도 있습니다.","search_google":"대신 구글에서 검색해보세요.","search_google_button":"구글","search_google_title":"이 사이트 검색","context":{"user":"@{{username}}의 글 검색","category":"#{{category}} 카테고리에서 검색","topic":"이 주제를 검색","private_messages":"메시지 검색"},"advanced":{"title":"고급 검색","posted_by":{"label":"글쓴이"},"in_group":{"label":"그룹에 속한"},"with_badge":{"label":"배지가 있는"},"filters":{"likes":"내가 좋아요 누른","posted":"내가 게시글을 쓴","watching":"내가 주시하는","tracking":"내가 추적하는","first":"가 가장 첫 포스트입니다.","pinned":"핀고정된","unpinned":"핀고정 되지 않은","unseen":"읽지 않은 것","wiki":"은(는) 위키입니다."},"statuses":{"label":"토픽 조건","open":"가 열렸습니다","closed":"가 닫혔습니다","archived":"가 보관되었습니다","noreplies":"답글이 없습니다","single_user":"1명의 사용자를 포함합니다"},"post":{"count":{"label":"최소 게시글 수"},"time":{"label":"게시날짜","before":"이전","after":"이후"}}}},"hamburger_menu":"다른 주제 목록이나 카테고리로 가기","new_item":"새로운","go_back":"돌아가기","not_logged_in_user":"user page with summary of current activity and preferences","current_user":"사용자 페이지로 이동","view_all":"모두 보기","topics":{"new_messages_marker":"마지막 조회시간","bulk":{"select_all":"모두 선택","clear_all":"모두 지우기","unlist_topics":"주제 내리기","relist_topics":"토픽 재정렬하기","reset_read":"읽기 초기화","delete":"주제 삭제","dismiss":"해지","dismiss_read":"읽지않음 전부 해지","dismiss_button":"해지...","dismiss_tooltip":"새 글을 무시하거나 주제 추적 멈추기","also_dismiss_topics":"이 주제를 더 이상 추적하지 않고 읽지 않은 글에서 표시하지 않음","dismiss_new":"새글 제거","toggle":"주제 복수 선택","actions":"일괄 적용","change_category":"카테고리 설정하기","close_topics":"주제 닫기","archive_topics":"주제 보관하기","notification_level":"알림","choose_new_category":"주제의 새로운 카테고리를 선택","selected":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 주제가 선택되었습니다."},"change_tags":"태그 교체","append_tags":"태그 덧붙이기","choose_new_tags":"이 토픽의 태그를 입력하세요:","choose_append_tags":"이 토픽에 추가할 태그를 입력하세요:","changed_tags":"토픽의 태그가 변경되었습니다."},"none":{"unread":"읽지 않은 주제가 없습니다.","new":"읽을 새로운 주제가 없습니다.","read":"아직 어떠한 주제도 읽지 않았습니다.","posted":"아직 어떠한 주제도 작성되지 않았습니다.","latest":"최신 주제가 없습니다.","bookmarks":"아직 북마크한 주제가 없습니다.","category":"{{category}}에 주제가 없습니다.","top":"Top 주제가 없습니다.","educate":{"new":"\u003cp\u003e회원님의 주제는 여기에 나타납니다.\u003c/p\u003e\u003cp\u003e기본적으로 생긴 지 이틀 안된 주제는 새것으로 간주하고 \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e 표시가 뜹니다.\u003c/p\u003e\u003cp\u003e바꾸고 싶으면 \u003ca href=\"%{userPrefsUrl}\"\u003e환경설정\u003c/a\u003e으로 가보세요.\u003c/p\u003e","unread":"\u003cp\u003e회원님이 읽지 않은 주제는 여기에 나타납니다.\u003c/p\u003e\u003cp\u003e기본적으로 주제는 읽지 않은 것으로 간주하고 다음과 같은 조건 중 하나를 만족하면 읽지 않은 글갯수 \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e 을 표시합니다:\u003c/p\u003e\u003cul\u003e\u003cli\u003e주제 만들기\u003c/li\u003e\u003cli\u003e주제에 댓글달기\u003c/li\u003e\u003cli\u003e주제를 4분 이상 읽기\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e또는 주제를 추적하거나 지켜보기 위해 각 주제의 밑부분에 달린 알림제어판에서 설정하는 경우도 포합됩니다.\u003c/p\u003e\u003cp\u003e설정을 바꾸려면 \u003ca href=\"%{userPrefsUrl}\"\u003e환경설정\u003c/a\u003e 페이지로 가세요.\u003c/p\u003e"}},"bottom":{"latest":"더 이상 읽을 최신 주제가 없습니다","posted":"더 이상 작성된 주제가 없습니다","read":"더 이상 읽을 주제가 없습니다","new":"더 이상 읽을 새로운 주제가 없습니다.","unread":"더 이상 읽지 않은 주제가 없습니다","category":"더 이상 {{category}}에 주제가 없습니다","top":"더 이상 인기 주제가 없습니다.","bookmarks":"더이상 북마크한 주제가 없습니다."}},"topic":{"filter_to":{"other":"이 토픽에 {{count}}개 게시글"},"create":"새 주제 만들기","create_long":"새로운 주제 만들기","private_message":"메시지 시작","archive_message":{"help":"메시지를 아카이브로 옮기기","title":"저장됨"},"move_to_inbox":{"title":"수신함으로 이동","help":"메시지를 편지함으로 되돌리기"},"edit_message":{"help":"메시지의 첫 번째 게시물 수정","title":"메시지 수정"},"defer":{"title":"연기"},"list":"주제 목록","new":"새로운 주제","unread":"읽지 않은","new_topics":{"other":"{{count}}개의 새로운 주제"},"unread_topics":{"other":"{{count}}개의 읽지 않은 주제"},"title":"주제","invalid_access":{"title":"이 주제는 비공개입니다","description":"죄송합니다. 그 주제에 접근 할 수 없습니다!","login_required":"해당 주제를 보려면 로그인이 필요합니다."},"server_error":{"title":"주제를 불러오지 못했습니다","description":"죄송합니다. 연결 문제로 인해 해당 주제를 불러올 수 없습니다. 다시 시도하십시오. 문제가 지속되면 문의해 주시기 바랍니다"},"not_found":{"title":"주제를 찾을 수 없습니다","description":"죄송합니다. 주제를 찾을 수 없습니다. 아마도 운영자에 의해 삭제된 것 같습니다."},"total_unread_posts":{"other":"이 주제에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"unread_posts":{"other":"이 주제에 {{count}}개의 읽지 않을 게시 글이 있습니다."},"new_posts":{"other":"최근 읽은 이후 {{count}}개 글이 이 주제에 작성되었습니다."},"likes":{"other":"이 주제에 {{count}}개의 '좋아요'가 있습니다."},"back_to_list":"주제 리스트로 돌아갑니다.","options":"주제 옵션","show_links":"이 주제에서 링크를 표시합니다.","toggle_information":"주제의 세부 정보를 토글합니다.","read_more_in_category":"더 읽을거리가 필요하신가요? {{catLink}} 또는 {{latestLink}}를 살펴보세요.","read_more":"{{catLink}} 또는 {{latestLink}}에서 더 많은 토픽들을 찾으실 수 있습니다","browse_all_categories":"모든 카테고리 보기","view_latest_topics":"최신 주제 보기","suggest_create_topic":"새 주제를 작성 해 보실래요?","jump_reply_up":"이전 답글로 이동","jump_reply_down":"이후 답글로 이동","deleted":"주제가 삭제되었습니다","topic_status_update":{"title":"토픽 타이머","save":"타이머 설정","num_of_hours":"시간:","remove":"타이머 제거하기","publish_to":"게시되는 곳:","when":"게시일:","public_timer_types":"토픽 타이머","private_timer_types":"사용자 토픽 타이머"},"auto_update_input":{"none":"시간대 선택","later_today":"오늘 늦게","tomorrow":"내일","later_this_week":"이번 주 후반","this_weekend":"이번 주말","next_week":"다음 주","two_weeks":"2주","next_month":"다음 달","three_months":"3개월","six_months":"6개월","one_year":"1년","forever":"영구적","pick_date_and_time":"날짜와 시간을 ","set_based_on_last_post":"마지막 게시글 기준으로 닫기"},"publish_to_category":{"title":"발행 스케쥴링"},"temp_open":{"title":"임시로 열기"},"auto_reopen":{"title":"자동으로 열린 토픽"},"temp_close":{"title":"임시로 닫기"},"auto_close":{"title":"자동으로 닫힌 토픽","label":"토픽이 자동으로 열린 후 지난 시간:","error":"유효한 값을 입력하세요","based_on_last_post":"적어도 주제의 마지막 글이 이만큼 오래되지 않았으면 닫지 마세요."},"auto_delete":{"title":"자동 삭제 토픽"},"reminder":{"title":"다시 알림받기"},"status_update_notice":{"auto_open":"이 토픽은 %{timeLeft}후에 자동으로 열립니다.","auto_close":"이 토픽은 %{timeLeft}후에 자동으로 닫힙니다.","auto_publish_to_category":"이 토픽은 \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e에 %{timeLeft}시간이 지나면 발행됩니다.","auto_close_based_on_last_post":"이 주제는 마지막 답글이 달린 %{duration} 후 닫힙니다.","auto_delete":"이 토픽은 %{timeLeft}후에 자동으로 삭제됩니다.","auto_reminder":"%{timeLeft}후에 이 토픽을 다시 알려드리겠습니다."},"auto_close_title":"자동으로 닫기 설정","auto_close_immediate":{"other":"주제에 마지막 게시글이 올라온 지 %{hours} 시간이 지났기 때문에 이 주제는 곧 닫힐 예정입니다."},"timeline":{"back":"이전","back_description":"마지막으로 안읽은 게시글로 돌아가기","replies_short":"%{current} / %{total}"},"progress":{"title":"진행 중인 주제","go_top":"맨위","go_bottom":"맨아래","go":"이동","jump_bottom":"최근 글로 이동","jump_prompt":"넘어가기","jump_prompt_of":"번째, 총 %{count} 개 포스트","jump_bottom_with_number":"jump to post %{post_number}","jump_prompt_or":"또는","total":"총 글","current":"현재 글"},"notifications":{"title":"이 토픽에 대한 알림 빈도 변경","reasons":{"mailing_list_mode":"메일링 리스트 모드가 활성화되었기 때문에, 이 토픽의 답글을 메일을 통하여 받게 됩니다.","3_10":"이 토픽의 태그를 주시하고 있기 때문에 알림을 받게 됩니다.","3_6":"이 카테고리를 보고 있어서 알림을 받게 됩니다.","3_5":"자동으로 이 글을 보고있어서 알림을 받게 됩니다.","3_2":"이 주제를 보고있어서 알림을 받게 됩니다.","3_1":"이 주제를 생성하여서 알림을 받게 됩니다.","3":"이 주제를 보고있어서 알림을 받게 됩니다.","2_8":"이 카테고리를 추적중이므로, 새로운 게시글의 수를 표시합니다.","2_4":"이 토픽에 게시글을 남겼기 때문에, 새로운 게시글의 수를 표시합니다.","2_2":"이 토픽을 추적중이므로, 새로운 게시글의 수를 표시합니다.","2":"\u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003e이 토픽을 읽었기 때문에,\u003c/a\u003e 새로운 게시글의 수를 표시합니다.","1_2":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다.","1":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다.","0_7":"이 주제에 관한 모든 알림을 무시하고 있습니다.","0_2":"이 주제에 관한 모든 알림을 무시하고 있습니다.","0":"이 주제에 관한 모든 알림을 무시하고 있습니다."},"watching_pm":{"title":"알림 : 주시 중","description":"이 메시지에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"watching":{"title":"주시 중","description":"이 주제에 새로운 답글이 있을 때 알림을 받게 되며 새로운 답글의 개수는 표시됩니다."},"tracking_pm":{"title":"추적 중","description":"이 메시지의 읽지않은 응답의 수가 표시됩니다. 누군가 내 @아이디를 멘션했거나 내게 답글을 작성하면 알림을 받습니다."},"tracking":{"title":"추적 중","description":"이 주제의 새로운 답글의 수가 표시됩니다. 누군가 내 @아이디를 멘션했거나 내게 답글을 작성하면 알림을 받습니다."},"regular":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다."},"regular_pm":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 내 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted_pm":{"title":"알림 : 끔","description":"이 메시지에 대해 어떠한 알림도 받지 않지 않습니다."},"muted":{"title":"알림 없음","description":"이 주제에 대해 어떠한 알림도 받지 않고 최신글 목록에도 나타나지 않을 것입니다."}},"actions":{"title":"액션","recover":"주제 다시 복구","delete":"주제 삭제","open":"주제 열기","close":"주제 닫기","multi_select":"글 선택","timed_update":"토픽 타이머 설정...","pin":"주제 고정...","unpin":"주제 고정 취소...","unarchive":"주제 보관 취소","archive":"주제 보관","invisible":"목록에서 제외하기","visible":"목록에 넣기","reset_read":"값 재설정","make_public":"공개 토픽으로 만들기","reset_bump_date":"끌어올림 날자 리셋"},"feature":{"pin":"주제 고정","unpin":"주제 고정 취소","pin_globally":"전체 공지글로 설정하기","make_banner":"배너 주제","remove_banner":"배너 주제 제거"},"reply":{"title":"답글쓰기","help":"이 토픽 게시글 구성 시작하기"},"clear_pin":{"title":"고정 취소","help":"더 이상 목록의 맨 위에 표시하지 않도록 이 주제의 고정 상태를 해제합니다."},"share":{"title":"공유하기","help":"이 토픽의 링크를 공유하기"},"print":{"title":"프린트하기","help":"이 토픽을 인쇄하기 좋은 버전으로 보기"},"flag_topic":{"title":"신고하기","help":"이 주제를 주의깊게 보거나 비밀리에 주의성 알림을 보내기 위해 신고합니다","success_message":"신고했습니다"},"feature_topic":{"title":"주요 주제로 설정","pin":" {{categoryLink}} 카테고리 주제 목록 상단에 고정 until","confirm_pin":"이미 {{count}}개의 고정된 주제가 있습니다. 너무 많은 주제가 고정되어 있으면 새로운 사용자나 익명사용자에게 부담이 될 수 있습니다. 정말로 이 카테고리에 추가적으로 주제를 고정하시겠습니까?","unpin":"이 주제를 {{categoryLink}} 카테고리 상단에서 제거 합니다.","unpin_until":"{{categoryLink}} 카테고리 주제 목록 상단에서 이 주제를 제거하거나 \u003cstrong\u003e%{until}\u003c/strong\u003e까지 기다림.","pin_note":"개별적으로 사용자가 주제 고정을 취소할 수 있습니다.","pin_validation":"주제를 고정하려면 날짜를 지정해야 합니다.","not_pinned":" {{categoryLink}} 카테고리에 고정된 주제가 없습니다.","already_pinned":{"other":"{{categoryLink}}에 고정된 주제 개수: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"모든 주제 목록 상단 고정 until","confirm_pin_globally":"이미 {{count}}개의 주제가 전체 공지로 고정되어 있습니다. 너무 많은 주제가 고정되어 있으면 새로운 사용자나 익명사용자에게 부담이 될 수 있습니다. 정말로 이 주제를 전체 공지로 고정하겠습니까?","unpin_globally":"모든 주제 목록 상단에서 이 주제를 제거","unpin_globally_until":"모든 주제 목록 상단에서 이 주제를 제거하거나 \u003cstrong\u003e%{until}\u003c/strong\u003e까지 기다림.","global_pin_note":"개별적으로 사용자가 주제 고정을 취소할 수 있습니다.","not_pinned_globally":"전체 공지된 주제가 없습니다.","already_pinned_globally":{"other":"전체 공지된 주제 개수: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"이 주제를 모든 페이지의 상단에 나타나는 배너로 만들기","remove_banner":"모든 페이지에서 나타나는 배너에서 제거","banner_note":"사용자는 배너를 닫음으로써 배너를 나타나지 않게 할 수 있습니다. 단지 어떤 기간동안 딱 하나의 주제만이 배너로 지정 가능합니다.","no_banner_exists":"배너 주제가 없습니다.","banner_exists":"현재 배너 주제가 \u003cstrong class='badge badge-notification unread'\u003e있습니다\u003c/strong\u003e."},"inviting":"초대 중...","automatically_add_to_groups":"이 초청은 다음 그룹에 대한 접근권한도 포함합니다:","invite_private":{"title":"초대 메시지","email_or_username":"초대하려는 이메일 또는 아이디","email_or_username_placeholder":"이메일 또는 아이디","action":"초대","success":"사용자가 메세지에 참여할 수 있도록 초대했습니다.","success_group":"해당 사용자가 메세지에 참여할 수 있도록 초대했습니다.","error":"죄송합니다. 해당 사용자를 초대하는 도중 오류가 발생했습니다.","group_name":"그룹명"},"controls":"토픽 컨트롤","invite_reply":{"title":"초대하기","username_placeholder":"아이디","action":"초대장 보내기","help":"이메일을 통해 다른 사람을 이 주제에 초대합니다.","to_forum":"친구에게 요약 이메일을 보내고 이 포럼에 가입할 수 있도록 링크를 전송합니다.","sso_enabled":"이 주제에 초대하고 싶은 사람의 아이디를 입력하세요.","to_topic_blank":"이 주제에 초대하고 싶은 사람의 아이디나 이메일주소를 입력하세요.","to_topic_email":"이메일 주소를 입력하셨습니다. 친구들에게 이 주제에 답변 달기가 가능하도록 조치하는 초대장을 보내겠습니다.","to_topic_username":"아이디를 입력하셨습니다. 이 주제에 초대하는 링크와 함께 알림을 보내겠습니다.","to_username":"초대하려는 사용자의 아이디를 입력하세요. 이 주제에 초대하는 링크와 함께 알림을 보내겠습니다.","email_placeholder":"이메일 주소","success_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e로 초대장을 발송했습니다. 초대를 수락하면 알려 드리겠습니다. 초대상태를 확인하려면 사용자 페이지에서 '초대장' 탭을 선택하세요.","success_username":"사용자가 이 주제에 참여할 수 있도록 초대했습니다.","error":"그 사람을 초대할 수 없습니다. 혹시 이미 초대하진 않았나요? (Invites are rate limited)","success_existing_email":"해당 email을 사용하고 있는 사용자 \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e 가 이미 존재합니다. 그 사용자를 이 토픽에 참여하도록 초청했습니다."},"login_reply":"로그인하고 답글 쓰기","filters":{"n_posts":{"other":"{{count}} 글"},"cancel":"필터 제거"},"split_topic":{"title":"새로운 주제로 이동","action":"새로운 주제로 이동","radio_label":"새 주제글","error":"새로운 주제로 이동시키는데 문제가 발생하였습니다.","instructions":{"other":"새로운 주제를 생성하여, 선택한 \u003cb\u003e{{count}}\u003c/b\u003e개의 글로 채우려고 합니다."}},"merge_topic":{"title":"이미 있는 주제로 옮기기","action":"이미 있는 주제로 옮기기","error":"이 주제를 이동시키는데 문제가 발생하였습니다.","instructions":{"other":" \u003cb\u003e{{count}}\u003c/b\u003e개의 글을 옮길 주제를 선택해주세요."}},"move_to_new_message":{"radio_label":"새로운 메시지","participants":"참여자"},"move_to_existing_message":{"participants":"참여자"},"merge_posts":{"title":"선택한 게시글 합치기","action":"선택한 게시글 합치기","error":"선택한 게시글을 합치는 중 에러가 발생했습니다."},"change_owner":{"action":"작성자 바꾸기","error":"작성자를 바꾸는 중 에러가 발생하였습니다.","placeholder":"새로운 작성자의 아이디"},"change_timestamp":{"title":"타임스탬프 변경하기...","action":"타임스탬프 변경","invalid_timestamp":"타임스탬프는 미래값으로 할 수 없습니다.","error":"주제의 시간을 변경하는 중 오류가 발생하였습니다.","instructions":"토픽의 새로운 타임스탬프를 선택해주세요. 토픽에 속한 게시글은 같은 시간 간격으로 조정됩니다."},"multi_select":{"select":"선택","selected":"({{count}})개가 선택됨","select_post":{"label":"선택"},"selected_post":{"label":"선택됨"},"select_replies":{"label":"선택 + 답글"},"delete":"선택 삭제","cancel":"선택을 취소","select_all":"전체 선택","deselect_all":"전체 선택 해제","description":{"other":"\u003cb\u003e{{count}}\u003c/b\u003e개의 개시글을 선택하셨어요."}}},"post":{"quote_reply":"인용하기","edit_reason":"사유: ","post_number":"{{number}}번째 글","wiki_last_edited_on":"마지막으로 위키가 수정된 일시","last_edited_on":"마지막으로 편집:","reply_as_new_topic":"연결된 주제로 답글 작성하기","reply_as_new_private_message":"같은 수신자에게 새로운 메시지로 답글쓰기","continue_discussion":"{{postLink}}에서 토론을 계속:","follow_quote":"인용 글로 이동","show_full":"전체 글 보기","deleted_by_author":{"other":"(작성자에 의해 취소된 글입니다. 글이 신고된 것이 아닌 한 %{count} 시간 뒤에 자동으로 삭제됩니다)"},"collapse":"축소","expand_collapse":"확장/축소","locked":"이 글은 운영진에 의해 수정이 금지 되었습니다.","gap":{"other":"{{count}}개의 숨겨진 답글 보기"},"unread":"읽지 않은 포스트","has_replies":{"other":"{{count}} 답글"},"has_likes_title":{"other":"{{count}}명이 이 글을 좋아합니다"},"has_likes_title_only_you":"당신이 이 글을 좋아합니다.","has_likes_title_you":{"other":"당신 외 {{count}}명이 이 글을 좋아합니다"},"errors":{"create":"죄송합니다. 글을 만드는 동안 오류가 발생했습니다. 다시 시도하십시오.","edit":"죄송합니다. 글을 수정하는 중에 오류가 발생했습니다. 다시 시도하십시오.","upload":"죄송합니다. 파일을 업로드하는 동안 오류가 발생했습니다. 다시 시도하십시오.","too_many_uploads":"한번에 한 파일만 업로드 하실 수 있습니다.","upload_not_authorized":"죄송합니다. 허가되지 않은 확장자의 파일이 있습니다. (허가된 확장자: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 이미지를 업로드 하실 수 없습니다.","attachment_upload_not_allowed_for_new_user":"죄송합니다. 새로운 유저는 파일 첨부를 업로드 하실 수 없습니다.","attachment_download_requires_login":"죄송합니다. 첨부 파일을 받으려면 로그인이 필요합니다."},"abandon_edit":{"no_value":"아니요, 버리지 않습니다."},"abandon":{"confirm":"글 작성을 취소 하시겠습니까?","no_value":"아니오","yes_value":"예"},"via_email":"이 주제는 이메일을 통해 등록되었습니다.","via_auto_generated_email":"이 게시글은 자동 생성된 이메일로 작성되었습니다","whisper":"이 포스트는 운영자를 위한 비공개 귓말입니다.","wiki":{"about":"이 게시글은 위키입니다"},"archetypes":{"save":"옵션 저장"},"few_likes_left":"사랑을 나누어주셔서 감사합니다! 오늘 표시할 수 있는 좋아요가 얼마 남지 않았습니다.","controls":{"reply":"이 글에 대한 답글을 작성합니다.","like":"이 글을 좋아합니다.","has_liked":"이 글을 좋아합니다.","undo_like":"'좋아요' 취소","edit":"이 글 편집","edit_action":"편집","edit_anonymous":"이 주제를 수정하려면 먼저 로그인을 해야합니다.","flag":"이 주제에 관심을 가지기 위해 깃발을 표시해두고 개인적으로 알림을 받습니다","delete":"이 글을 삭제합니다.","undelete":"이 글 삭제를 취소합니다.","share":"이 글에 대한 링크를 공유합니다.","more":"더","delete_replies":{"confirm":"이 글에 대한 댓글을 삭제 하시겠습니까?","just_the_post":"아니오, 글만 삭제합니다."},"admin":"관리자 기능","wiki":"위키 만들기","unwiki":"위키 제거하기","convert_to_moderator":"스태프 색상 추가하기","revert_to_regular":"스태프 색상 제거하기","rebake":"HTML 다시 빌드하기","unhide":"숨기지 않기","change_owner":"소유자 변경","grant_badge":"배지 부여","lock_post":"글 잠그기","unlock_post":"글 잠금 해제","unlock_post_description":"작성자가 글을 수정하도록 허용","delete_topic_disallowed":"이 글을 삭제할 수있는 권한이 없습니다","delete_topic":"토픽 삭제"},"actions":{"flag":"신고하기","undo":{"off_topic":"신고 취소","spam":"신고 취소","inappropriate":"신고 취소","bookmark":"북마크 취소","like":"좋아요 취소"},"people":{"off_topic":"주제에서 벗어났다고 신고했습니다","spam":"스팸으로 신고했습니다","inappropriate":"부적절한 글로 신고했습니다","notify_moderators":"운영자에게 알렸습니다","notify_user":"글쓴이에게 메시지를 보냈습니다","bookmark":"북마크 했습니다"},"by_you":{"off_topic":"이글을 주제에서 벗어났다고 신고했습니다","spam":"이글을 스팸으로 신고했습니다","inappropriate":"이 글을 부적절한 컨텐츠로 신고했습니다","notify_moderators":"운영자에게 알렸습니다","notify_user":"글쓴이에게 메시지를 보냈습니다","bookmark":"이 글을 북마크했습니다","like":"좋아해요"}},"delete":{"confirm":{"other":"정말로 {{count}}개의 글을 삭제 하시겠습니까?"}},"merge":{"confirm":{"other":"정말로 이 {{count}}개의 게시글을 합칠까요?"}},"revisions":{"controls":{"first":"초판","previous":"이전 판","next":"다음 판","last":"최신판","hide":"편집 기록 가리기","show":"편집 기록 보기","revert":"이 수정본으로 되돌리기","edit_wiki":"Wiki 편집","edit_post":"포스트 편집"},"displays":{"inline":{"title":"Show the rendered output with additions and removals inline","button":"HTML"},"side_by_side":{"title":"Show the rendered output diffs side-by-side","button":"HTML"},"side_by_side_markdown":{"title":"Raw source diff를 양쪽으로 보기","button":"Raw"}}},"raw_email":{"displays":{"raw":{"title":"raw 이메일 표시하기","button":"Raw"},"text_part":{"title":"이메일 텍스트 파트 보이기","button":"텍스트"},"html_part":{"title":"이메일 HTML 파트 보이기","button":"HTML"}}},"bookmarks":{"created":"생성일자","name":"이름"}},"category":{"can":"허용","none":"(카테고리 없음)","all":"모든 카테고리","choose":"카테고리\u0026hellip;","edit":"수정","view":"카테고리 안의 주제 보기","general":"일반","settings":"설정","topic_template":"주제 템플릿","tags":"태그","tags_placeholder":"(선택사항) 허용된 태그 목록","tag_groups_placeholder":"(선택사항) 허용된 태그 그룹 목록","topic_featured_link_allowed":"이 카테고리에 주요 링크 허용","delete":"카테고리 삭제","create":"새 카테고리","create_long":"새 카테고리 만들기","save":"카테고리 저장","slug":"카테고리 Slug","slug_placeholder":"(Optional) dashed-words for url","creation_error":"카테고리 생성 중 오류가 발생했습니다.","save_error":"카테고리 저장 중 오류가 발생했습니다.","name":"카테고리 이름","description":"설명","topic":"카테고리 주제","logo":"카테고리 로고 이미지","background_image":"카테고리 백그라운드 이미지","badge_colors":"배지 색상","background_color":"배경 색상","foreground_color":"글씨 색상","name_placeholder":"짧고 간결해야합니다","color_placeholder":"웹 색상","delete_confirm":"이 카테고리를 삭제 하시겠습니까?","delete_error":"카테고리를 삭제하는 동안 오류가 발생했습니다.","list":"카테고리 목록","no_description":"이 카테고리에 대한 설명을 추가해주세요.","change_in_category_topic":"설명 편집","already_used":"이 색은 다른 카테고리에서 사용되고 있습니다.","security":"보안","special_warning":"경고: 이 카테고리는 사전 생성된 카테고리이기 때문에 보안 설정 변경이 불가합니다. 이 카테고리를 사용하고 싶지 않다면, 수정하지말고 삭제하세요.","images":"이미지","email_in":"incoming 메일 주소 수정","email_in_allow_strangers":"계정이 없는 익명 유저들에게 이메일을 받습니다.","email_in_disabled":"이메일로 새 주제 작성하기 기능이 비활성화되어 있습니다. 사이트 설정에서 '이메일로 새 주제 작성하기'를 활성화 해주세요.","email_in_disabled_click":"\"email in\" 활성화","show_subcategory_list":"하위 카테고리 목록을 토픽위에 표시하기.","num_featured_topics":"이 카테고리 페이지에 표시되는 토픽의 수:","subcategory_num_featured_topics":"부모 카테고리 페이지에 표시되는 주요 토픽의 수:","subcategory_list_style":"하위 카테고리 목록 스타일:","sort_order":"다음 기준으로 토픽 목록 정렬:","default_view":"기본 토픽 목록:","default_top_period":"기본 Top 기간:","allow_badges_label":"배지가 이 카테고리에서 주어질 수 있도록 허용","edit_permissions":"권한 수정","review_group_name":"그룹명","this_year":"올해","default_position":"기본 위치","position_disabled":"카테고리는 활동량에 따라서 표시됩니다. 목록 내의 카테고리 순서를 지정하하려면","position_disabled_click":"\"카테고리 위치 고정\" 설정을 활성화 시키십시요.","parent":"부모 카테고리","notifications":{"watching":{"title":"주시 중","description":"이 카테고리의 모든 토픽을 주시하도록 자동 설정됩니다. 모든 토픽과 게시글에 대하여 알림을 받게 되며, 새로운 게시글의 수가 표시됩니다."},"watching_first_post":{"title":"첫번째 글 보기"},"tracking":{"title":"추적 중","description":"이 카테고리의 모든 토픽을 추적하도록 자동 설정됩니다. 다른 사용자가 당신의 @이름 을 언급하거나 당신의 게시글에 답글을 달 때 알림을 받게 되며 새로운 게시글의 수가 표시됩니다."},"regular":{"title":"알림 : 일반","description":"누군가 내 @아아디 으로 멘션했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted":{"title":"알림 꺼짐","description":"이 카테고리 내의 새 토픽에 대해 어떠한 알림도 받지 않으며, 최신 토픽 항목에도 나타나지 않습니다."}},"search_priority":{"options":{"normal":"알림 : 일반","ignore":"무시","high":"높음"}},"sort_options":{"default":"기본값","likes":"좋아요 수","op_likes":"원본 게시글 좋아요 수","views":"조회수","posts":"게시글 수","activity":"활동","posters":"게시자","category":"카테고리","created":"생성일자","votes":"투표"},"sort_ascending":"오름차순","sort_descending":"내림차순","subcategory_list_styles":{"rows":"행수","rows_with_featured_topics":"주요 토픽의 행 스타일","boxes":"박스","boxes_with_featured_topics":"주요 토픽의 박스 스타일"},"settings_sections":{"general":"일반","email":"이메일"}},"flagging":{"title":"우리 커뮤니티 질서를 지키는데 도와주셔서 감사합니다!","action":"글 신고했습니다","take_action":"조치하기","notify_action":"메시지 보내기","official_warning":"공식 경고","delete_spammer":"네, 스패머 회원을 삭제합니다","yes_delete_spammer":"예, 스팸 회원을 삭제합니다","ip_address_missing":"(알 수 없음)","hidden_email_address":"(숨김)","submit_tooltip":"비밀 신고하기","take_action_tooltip":"커뮤니티의 신고 수가 채워지기 기다리지 않고, 바로 신고 수를 제재 수준까지 채웁니다.","cant":"죄송합니다, 지금은 이 글을 신고할 수 없습니다","notify_staff":"운영진에게 알리기","formatted_name":{"off_topic":"주제에 벗어났습니다","inappropriate":"부적절 컨텐츠입니다","spam":"스팸입니다"},"custom_placeholder_notify_user":"구체적이고, 건설적이며, 항상 친절하세요.","custom_placeholder_notify_moderators":"구체적으로 회원님이 걱정하는 내용과 가능한 모든 관련된 링크를 제공해주세요.","custom_message":{"at_least":{"other":"최소 {{count}}자 이상 입력하세요"},"more":{"other":"{{count}} 남았습니다"},"left":{"other":"{{count}} 남았습니다"}}},"flagging_topic":{"title":"우리 커뮤니티 질서를 지키는데 도와주셔서 감사합니다!","action":"주제 신고하기","notify_action":"메시지 보내기"},"topic_map":{"title":"주제 요약","participants_title":"빈번한 게시자","links_title":"인기 링크","links_shown":"더 많은 링크보기...","clicks":{"other":"%{count}번 클릭"}},"post_links":{"about":"이 게시글의 링크 더 보기","title":{"other":"%{count} more"}},"topic_statuses":{"warning":{"help":"공식적인 주의입니다."},"bookmarked":{"help":"북마크한 주제"},"locked":{"help":"이 주제는 폐쇄되었습니다. 더 이상 새 답글을 받을 수 없습니다."},"archived":{"help":"이 주제는 보관중입니다. 고정되어 변경이 불가능합니다."},"locked_and_archived":{"help":"이 토픽은 폐쇄되어 보관중입니다. 새로운 답글을 달거나 수정할 수 없습니다."},"unpinned":{"title":"핀 제거","help":"이 주제는 핀 제거 되었습니다. 목록에서 일반적인 순서대로 표시됩니다."},"pinned_globally":{"title":"핀 지정됨 (전역적)","help":"이 토픽은 전체 핀고정되었습니다. 최신 토픽과 이 토픽이 속한 카테고리 최상단에 표시됩니다."},"pinned":{"title":"핀 지정됨","help":"이 주제는 고정되었습니다. 카테고리의 상단에 표시됩니다."},"unlisted":{"help":"이 주제는 목록에서 제외됩니다. 주제 목록에 표시되지 않으며 링크를 통해서만 접근 할 수 있습니다."}},"posts":"글","posts_long":"이 주제의 글 수는 {{number}}개 입니다.","original_post":"원본 글","views":"조회수","views_lowercase":{"other":"조회"},"replies":"답변","views_long":{"other":"이 토픽은 {{number}}번 조회되었습니다."},"activity":"활동","likes":"좋아요","likes_lowercase":{"other":"좋아요"},"likes_long":"이 주제에 {{number}}개의 '좋아요'가 있습니다.","users":"사용자","users_lowercase":{"other":"사용자"},"category_title":"카테고리","history":"기록","changed_by":"{{author}}에 의해","raw_email":{"title":"수신 이메일","not_available":"Raw 이메일이 가능하지 않습니다."},"categories_list":"카테고리 목록","filters":{"with_topics":"%{filter} 주제","with_category":"%{filter} %{category} 주제","latest":{"title":"최근글","title_with_count":{"other":"최근글 ({{count}})"},"help":"가장 최근 주제"},"read":{"title":"읽기","help":"마지막으로 순서대로 읽은 주제"},"categories":{"title":"카테고리","title_in":"카테고리 - {{categoryName}}","help":"카테고리별로 그룹화 된 모든 주제"},"unread":{"title":"읽지 않은 글","title_with_count":{"other":"읽지 않은 글 ({{count}})"},"help":"지켜보거나 추적 중인 읽지 않은 주제","lower_title_with_count":{"other":"{{count}} unread"}},"new":{"lower_title_with_count":{"other":"{{count}} new"},"lower_title":"new","title":"새글","title_with_count":{"other":"새글 ({{count}})"},"help":"며칠 내에 만들어진 주제"},"posted":{"title":"내 글","help":"내가 게시한 글"},"bookmarks":{"title":"북마크","help":"북마크된 주제"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}}카테고리의 최신 주제"},"top":{"title":"인기글","help":"작년 또는 지난 달, 지난 주, 어제에 활발했던 주제","all":{"title":"전체 시간"},"yearly":{"title":"연"},"quarterly":{"title":"분기마다"},"monthly":{"title":"월"},"weekly":{"title":"주"},"daily":{"title":"일"},"all_time":"전체 시간","this_year":"년","this_quarter":"분기","this_month":"월","this_week":"주","today":"오늘","other_periods":"상단 보기"},"votes":{"title":"투표"}},"permission_types":{"full":"생성 / 답글 / 보기","create_post":"답글 / 보기","readonly":"보기"},"lightbox":{"download":"다운로드"},"keyboard_shortcuts_help":{"title":"키보드 단축키","jump_to":{"title":"이동","home":"%{shortcut} 홈","latest":"%{shortcut} 최신","new":"%{shortcut} 새로운","unread":"%{shortcut} 읽지 않은","categories":"%{shortcut} 카테고리","top":"%{shortcut} 인기글","bookmarks":"%{shortcut} 북마크","profile":"%{shortcut} 프로필","messages":"%{shortcut} 메시지"},"navigation":{"title":"탐색","jump":"%{shortcut} 글 번호로 이동","back":"%{shortcut} 이전","up_down":"%{shortcut} 선택된 글 이동 \u0026uarr; \u0026darr;","open":"%{shortcut} 선택한 토픽 열기","next_prev":"%{shortcut} 이전/다음 섹션"},"application":{"title":"어플리케이션","create":"%{shortcut} 새 토픽을 만듭니다.","notifications":"%{shortcut} 알림창 열기","hamburger_menu":"%{shortcut} 햄버거 메뉴 열기","user_profile_menu":"%{shortcut} 사용자 메뉴 열기","show_incoming_updated_topics":"%{shortcut} 갱신된 토픽 보기","search":"%{shortcut} 를 사용하여 검색","help":"%{shortcut} 키보드 도움말 열기","dismiss_new_posts":"%{shortcut} 새글을 읽은 상태로 표시하기","dismiss_topics":"%{shortcut} 토픽 무시하기","log_out":"%{shortcut} 로그아웃"},"actions":{"title":"액션","bookmark_topic":"%{shortcut} 북마크 토픽 켜고 끄기","pin_unpin_topic":"%{shortcut} 핀고정/핀해제","share_topic":"%{shortcut} 토픽 공유","share_post":"%{shortcut} 게시글 공유","reply_as_new_topic":"%{shortcut} 연결된 토픽으로 답글 작성하기","reply_topic":"%{shortcut} 토픽에 답글 달기","reply_post":"%{shortcut} 글에 답글 달기","quote_post":"%{shortcut} 게시글 인용","like":"%{shortcut} 게시글에 좋아요 표시","flag":"%{shortcut} 게시글에 플래그달기","bookmark":"%{shortcut} 게시글 북마크","edit":"%{shortcut} 게시글 편집","delete":"%{shortcut} 게시글 삭제","mark_muted":"%{shortcut} 토픽 알람 : 끄기","mark_regular":"%{shortcut} 토픽 알람 : 일반(기본)으로 설정하기","mark_tracking":"%{shortcut} 토픽 알람 : 추적하기","mark_watching":"%{shortcut} 토픽 알람 : 주시하기","print":"%{shortcut} 토픽 인쇄하기"}},"badges":{"earned_n_times":{"other":"이 배지를 %{count}번 받았습니다"},"granted_on":"%{date} 에 수여함","others_count":"(%{count})명의 사용자가 이 배지를 가지고 있습니다","title":"배지","allow_title":"이 배지는 타이틀로 사용할 수 있습니다","multiple_grant":"이 배지는 중복해서 취득할 수 있습니다","badge_count":{"other":"%{count}개의 배지"},"more_badges":{"other":"+%{count}개 이상"},"granted":{"other":"%{count}개 수여됨"},"select_badge_for_title":"타이틀로 사용할 배지 선택하기","none":"(없음)","badge_grouping":{"getting_started":{"name":"시작하기"},"community":{"name":"커뮤니티"},"trust_level":{"name":"신뢰 레벨"},"other":{"name":"기타"},"posting":{"name":"포스팅"}}},"tagging":{"all_tags":"모든 태그","other_tags":"기타 태그","selector_all_tags":"모든 태그","selector_no_tags":"태그 없음","changed":"바뀐 태그:","tags":"태그","choose_for_topic":"선택적 태그","add_synonyms":"추가","delete_tag":"태그 삭제","delete_confirm":{"other":"정말로 이 태그를 삭제하고 이 태그가 붙은 {{count}} 개의 토픽에서 태그를 제거할까요?"},"delete_confirm_no_topics":"정말로 이 태그를 삭제할까요?","rename_tag":"태그 이름변경","rename_instructions":"새로운 태그의 이름을 입력하세요:","sort_by":"정렬 기준:","sort_by_count":"갯수","sort_by_name":"이름","manage_groups":"태그 그룹 관리","manage_groups_description":"태그 정리를 위한 그룹 정의","cancel_delete_unused":"취소","filters":{"without_category":"%{filter} %{tag} 토픽","with_category":"%{category}에서 %{filter}%{tag}태그가 달린 토픽","untagged_without_category":"%{filter} 태깅안된 토픽","untagged_with_category":"%{category}에서 %{filter}태그가 없는 토픽"},"notifications":{"watching":{"title":"주시중"},"watching_first_post":{"title":"첫 게시글 주시중"},"tracking":{"title":"추적중"},"regular":{"title":"일반","description":"누군가 당신의 @아이디 로 언급했거나 당신의 글에 답글이 달릴 때 알림을 받게 됩니다."},"muted":{"title":"알림끔"}},"groups":{"title":"태그 그룹","about":"태그 관리를 쉽게하려면 그룹에 태그를 추가하세요.","new":"새 그룹","tags_label":"이 그룹의 태그:","parent_tag_label":"부모 태그:","parent_tag_placeholder":"선택사항","parent_tag_description":"이 그룹에 속한 태그는 부모 태그가 붙기 전에는 사용할 수 없습니다.","one_per_topic_label":"이 그룹의 태그는 토픽당 하나만 선택할 수 있도록 제한하기","new_name":"새 태그 그룹","save":"저장","delete":"삭제","confirm_delete":"정말로 이 태그 그룹을 삭제할까요?","visible_only_to_staff":"태그는 운영진 에게만 표시됩니다"},"topics":{"none":{"unread":"읽지 않은 토픽이 없습니다.","new":"새로운 토픽이 없습니다.","read":"아직 어떠한 토픽도 읽지 않았습니다.","posted":"아직 게시글을 하나도 쓰지 않았습니다.","latest":"최신 토픽이 없습니다.","bookmarks":"북마크한 토픽이 없습니다.","top":"인기 토픽이 없습니다."},"bottom":{"latest":"더 이상 최신 토픽이 없습니다.","posted":"더 이상 작성된 토픽이 없습니다.","read":"더 이상 읽은 토픽이 없습니다.","new":"더 이상 새로운 토픽이 없습니다.","unread":"더 이상 읽지 않은 토픽이 없습니다.","top":"더 이상 인기 토픽이 없습니다.","bookmarks":"더 이상 북마크한 토픽이 없습니다."}}},"invite":{"custom_message_placeholder":"사용자 설정 메시지를 입력하세요","custom_message_template_forum":"저기요, 이 포럼에 가입하셔야 해요!","custom_message_template_topic":"이 토픽에 흥미 있을 거 같은데요!"},"safe_mode":{"enabled":"안전모드가 활성화 되었습니다. 안전모드를 종료하려면 이 웹브라우저창을 닫아야 합니다."},"poll":{"voters":{"other":"투표자"},"total_votes":{"other":"전체 투표"},"average_rating":"평균: \u003cstrong\u003e%{average}\u003c/strong\u003e.","multiple":{"help":{"at_least_min_options":{"other":"최소 \u003cstrong\u003e%{count}\u003c/strong\u003e개의 선택지를 택해야 합니다."},"up_to_max_options":{"other":"최대 \u003cstrong\u003e%{count}\u003c/strong\u003e 개까지 선택지를 고를 수 있습니다"},"x_options":{"other":"\u003cstrong\u003e%{count}\u003c/strong\u003e 개의 선택지를 고르세요"},"between_min_and_max_options":"최소 \u003cstrong\u003e%{min}\u003c/strong\u003e개에서 최대 \u003cstrong\u003e%{max}\u003c/strong\u003e개까지 선택 가능합니다."}},"cast-votes":{"title":"표 던지기","label":"지금 투표!"},"show-results":{"title":"투표 결과 표시","label":"결과 보기"},"hide-results":{"title":"투표로 돌아가기"},"export-results":{"label":"내보내기"},"open":{"title":"투표 열기","label":"열기","confirm":"투표를 여시겠습니까?"},"close":{"title":"투표 닫기","label":"닫기","confirm":"정말 이 투표를 닫으시겠어요?"},"error_while_toggling_status":"죄송합니다. 이 투표의 상태를 바꾸는 도중 에러가 발생하였습니다.","error_while_casting_votes":"죄송합니다. 투표를 하는 도중 에러가 발생하였습니다.","error_while_fetching_voters":"죄송합니다. 투표한 사람을 표시하는 도중 에러가 발생하였습니다.","ui_builder":{"title":"투표 만들기","insert":"투표 삽입하기","help":{"invalid_values":"최소값은 최대값보다는 작아야 합니다."},"poll_type":{"label":"유형","regular":"단일 선택","multiple":"복수 선택","number":"점수 매기기"},"poll_result":{"label":"검색 결과"},"poll_config":{"max":"최대","min":"최소","step":"단계"},"poll_public":{"label":"투표한 사람 보기"},"poll_options":{"label":"투표 선택지는 한줄에 하나씩 입력하세요"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"모든 신규 사용자를 위한 튜토리얼을 시작합니다.","welcome_message":"모든 신규 사용자에게 퀵 스타트 가이드와 함께 환영 메세지를 보냅니다."}},"discourse_local_dates":{"relative_dates":{"today":"오늘 %{time}","tomorrow":"내일 %{time}","yesterday":"어제 %{time}"},"create":{"form":{"insert":"삽입","advanced_mode":"고급 모드","simple_mode":"단순 모드","format_description":"사용자에게 날짜를 표시하는 데 사용되는 형식. \"\\T\\Z\"를 사용하여 사용자 시간대를 단어 (유럽/파리)로 표시하십시오","timezones_title":"표시 할 시간대","timezones_description":"시간대는 미리보기 및 폴백으로 날짜를 표시하는 데 사용됩니다.","recurring_title":"반복","recurring_description":"이벤트의 반복을 정의하십시오. 양식에서 생성 된 반복 옵션을 수동으로 편집하고 연도, 분기, 월, 주, 일, 시, 분, 초, 밀리 초 중 하나를 사용할 수 있습니다.","recurring_none":"반복 없음","invalid_date":"날짜가 잘못되었습니다. 날짜와 시간이 올바른지 확인하십시오","date_title":"날짜","time_title":"시간","format_title":"날짜 형식","timezone":"시간대","recurring":{"every_day":"매일","every_week":"매주","every_two_weeks":"2주마다","every_month":"매월","every_two_months":"2개월마다","every_three_months":"3개월마다","every_six_months":"6개월마다","every_year":"매년"}}}},"details":{"title":"세부 정보 숨기기"},"presence":{"replying":"답변중","editing":"수정중","replying_to_topic":{"other":"답변중"}},"voting":{"list_votes":"내 투표 목록","voted":"이 주제에 투표했습니다","allow_topic_voting":"사용자가 이 카테고리의 주제에 투표하도록 허용함","vote_title":"투표","vote_title_plural":"투표","voted_title":"투표함","voting_closed_title":"닫힘","anonymous_button":{"other":"투표"}},"adplugin":{"advertisement_label":"광고"},"docker":{"upgrade":"설치된 Discourse가 최신 버전이 아닙니다.","perform_upgrade":"업그레이드 하려면 클릭"}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","related_messages":{"see_all":"查看来自 @%{username} 的\u003ca href=\"%{path}\"\u003e所有消息\u003c/a\u003e ..."},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"order_by":"排序依据","explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"awaiting_approval":"需要审核","settings":{"priorities":{"title":"需审核优先级"}},"grouped_by_topic":"依据主题分组","title":"审核","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站"},"topics":{"deleted":"[已删除的主题]","original":"（原主题）"},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）"}},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","reviewed_by":"审核者"},"statuses":{"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_queued_topic":{"title":"队列中到主题"}},"approval":{"pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"directory":{"last_updated":"最近更新："},"groups":{"member_requested":"请求于","requests":{"title":"请求","undone":"撤销请求","handle":"处理成员请求"},"manage":{"interaction":{"title":"交互"}},"empty":{"requests":"没有请求加入此群组的请求。"},"join":"加入","confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","index":{"owner_groups":"拥有的群组","public_groups":"公开的群组","close_group":"关闭群组","group_type":"群组类别","is_group_owner":"所有者"},"members":{"make_owner":"设为所有者","remove_owner":"撤销所有者","remove_owner_description":"把\u003cb\u003e%{username}\u003c/b\u003e从群组所有者中移除","owner":"所有者","forbidden":"你不可以查看成员列表。"},"alias_levels":{"owners_mods_and_admins":"仅群组成员、版主与管理员"},"notifications":{"watching_first_post":{"description":"你将收到有关此组中新消息的通知，但不会回复消息。"},"muted":{"description":"你不会收到有关此组中消息的任何通知。"}},"flair_url_description":"使用不小于20px × 20px的方形图像或FontAwesome图标（可接受的格式：“fa-icon”，“far fa-icon”或“fab fa-icon”）。"},"user_action_groups":{"15":"草稿"},"categories":{"topic_stat_sentence_week":{"other":"过去一周有%{count}个新主题。"},"topic_stat_sentence_month":{"other":"过去一个月有%{count}个新主题。"},"n_more":"分类 (还有%{count}个分类) ..."},"ip_lookup":{"powered_by":"使用\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e"},"user":{"user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_no_users":"你没有忽视任何用户","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","collapse_profile":"折叠","dynamic_favicon":"在浏览器图标上显示计数","theme_default_on_all_devices":"将其设为我所有设备上的默认主题","text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","mailing_list_mode":{"warning":"邮件列表模式启用。邮件通知设置被覆盖。"},"muted_categories_instructions":"你不会收到有关这些分类中新主题的任何通知，也不会出现在类别或最新页面上。","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","delete_yourself_not_allowed":"想删除账户请联系管理人员。","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","api_last_used_at":"最后使用于：","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"title":"两步备份码","manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","remaining_codes":"你有\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。","codes":{"description":"每个备份码只能使用一次。请存放于安全可读的地方。"}},"second_factor":{"enable":"管理两步验证","forgot_password":"忘记密码？","rate_limit":"请等待另一个验证码。","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","disable_description":"请输入来自 app 的验证码","show_key_description":"手动输入","short_description":"使用一次性安全码保护你的账户。\n","extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n","oauth_enabled_warning":"请注意，一旦你的账户启用了双重验证，社交登录将被停用。","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。"},"associated_accounts":{"title":"关联账户","confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"active":"现在活跃","show_all":"显示所有（{{count}}）","show_few":"显示部分","was_this_you":"这是你吗？","was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","browser_and_device":"{{browser}}在{{device}}","secure_account":"保护我的账户","latest_post":"你上次发布了......"},"enable_physical_keyboard":"在iPad上启用物理键盘支持","text_size":{"title":"文本大小","smaller":"更小","larger":"更大","largest":"最大"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件"},"email_level":{"only_when_away":"只在离开时"},"invited":{"sent":"上次发送","none":"无邀请显示。","rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","bulk_invite":{"confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"time_read_recently":"最近 %{time_read}","time_read_tooltip":"合计阅读时间 %{time_read}","time_read_recently_tooltip":"总阅读时间 %{time_read}（最近60天 %{recent_time_read}）","signup_cta":{"intro":"你好！看起来你正在享受讨论，但还没有注册一个账户。","value_prop":"当你创建了账户，我们就可以准确地记录你的阅读进度，你再次访问时就可以回到之前离开的地方。当有人回复你，你可以通过这里或电子邮件收到通知。并且你还可以通过点赞帖子向他人分享你的喜爱之情。:heartbeat:"},"private_message_info":{"invite":"邀请其他人..."},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"email_login":{"link_label":"给我通过邮件发送一个登录链接","button_label":"通过邮件","complete_username":"如果有一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email":"如果\u003cb\u003e%{email}\u003c/b\u003e与账户相匹配，你很快就会收到一封带有登录链接的电子邮件。","complete_username_found":"我们找到了一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email_found":"我们发现了一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_description":"请输入来自 app 的验证码：","second_factor_backup":"使用备用码登录","second_factor_backup_title":"两步验证备份","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","blank_username":"请输入你的邮件地址或用户名。","omniauth_disallow_totp":"你的账户已启用双重验证，请使用密码登录。","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"category_page_style":{"categories_and_top_topics":"分类和最热主题","categories_boxes":"带子分类的框","categories_boxes_with_topics":"有特色主题的框"},"shortcut_modifier_key":{"enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"filter_placeholder_with_any":"搜索或创建...","create":"创建：“{{content}}”","max_content_reached":{"other":"你只能选择 {{count}} 条记录。"},"min_content_not_reached":{"other":"选择至少{{count}}条。"},"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","activities":"活动","symbols":"符号"},"shared_drafts":{"title":"共享草稿","notice":"只有那些可以看到\u003cb\u003e{{category}}\u003c/b\u003e分类的人才能看到此主题。","destination_category":"目标分类","publish":"发布共享草稿","confirm_publish":"你确定要发布此草稿吗？","publishing":"发布主题中......"},"composer":{"edit_conflict":"编辑冲突","group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","tags_missing":"你必须至少选择{{count}}个标签","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"overwrite_edit":"覆盖编辑","create_whisper":"密语","create_shared_draft":"创建共享草稿","edit_shared_draft":"编辑共享草稿","remove_featured_link":"从主题中移除链接。","reply_placeholder_no_images":"在此输入。 使用 Markdown，BBCode 或 HTML 格式。","reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","toggle_direction":"切换方向","collapse":"最小化编辑面板","open":"打开编辑面板","abandon":"关闭编辑面板并放弃草稿","enter_fullscreen":"进入全屏编辑模式","exit_fullscreen":"退出全屏编辑模式","composer_actions":{"reply_to_post":{"label":"通过%{postUsername}回复帖子%{postNumber}","desc":"回复特定帖子"},"reply_as_new_topic":{"label":"回复为联结主题","desc":"创建一个新主题链接到这一主题","confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"},"reply_to_topic":{"label":"回复主题","desc":"回复主题，不是任何特定的帖子"},"toggle_whisper":{"label":"切换密语","desc":"只有管理人员才能看到密语"},"shared_draft":{"label":"共享草稿","desc":"起草一个只对管理人员可见的主题"},"toggle_topic_bump":{"label":"切换主题置顶","desc":"回复而不更改最新回复日期"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","liked_consolidated_description":{"other":"你的帖子有{{count}}个赞"},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","popup":{"private_message":"{{username}}在“{{topic}}”中向你发送了个人消息 - {{site_title}}","watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","membership_request_consolidated":"新的成员申请"}},"search":{"result_count":{"other":"\u003cspan\u003e{{count}}{{plus}}结果\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"in_category":{"label":"分类"},"with_tags":{"label":"标签"},"filters":{"label":"只返回主题/帖子……","title":"仅在标题中匹配","created":"我创建的","private":"在我的私信中","bookmarks":"我收藏了","seen":"我看了","images":"包含图片","all_tags":"上述所有标签"},"statuses":{"public":"是公开的"}}},"topic":{"open_draft":"打开草稿","defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"two_months":"两个月","four_months":"四个月"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"progress":{"jump_prompt_long":"跳到……","jump_prompt_to_date":"至今"},"actions":{"make_private":"设置为私信"},"share":{"extended_title":"分享一个链接"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"title":"更改所有者","instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"multi_select":{"select_post":{"title":"将帖子加入选择"},"selected_post":{"title":"单击以将帖子从中移除"},"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"ignored":"忽视的内容","show_hidden":"显示已忽略内容。","notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","delete_replies":{"direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}},"lock_post_description":"禁止发帖者编辑这篇帖子","delete_topic_disallowed_modal":"你无权删除该贴。如果你真想删除，向版主提交原因并标记。","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"defer_flags":{"other":"忽略标记"},"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"like_capped":{"other":"和其他 {{count}} 人赞了它"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"edit_dialog_title":"编辑: %{categoryName}","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","all_topics_wiki":"默认将新主题设为维基主题","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"}},"search_priority":{"label":"搜索优先级","options":{"very_low":"非常低","low":"低","very_high":"非常高"}},"settings_sections":{"moderation":"审核","appearance":"主题"}},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"filters":{"votes":{"help":"选票最多的主题"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","jump_to":{"drafts":"%{shortcut}草稿"},"navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"composing":{"title":"编辑","return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"badges":{"successfully_granted":"成功将 %{badge} 授予 %{username}"},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"upload":"上传标签","upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","upload_successful":"标签上传成功","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称","everyone_can_use":"每个人都可以使用标签","usable_only_by_staff":"标签对所有人可见，但只有管理人员可以使用它们"}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项","min_step_value":"最小步长为1"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"until":"直到......"}}},"voting":{"title":"投票","reached_limit":"你没有选票了，先删除一张已选票！","votes_nav_help":"选票最多的主题","voting_limit":"次数限制","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"remove_vote":"移除投票"}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m"},"about_x_hours":{"one":"%{count}h"},"x_days":{"one":"%{count}d"},"x_months":{"one":"%{count}mon"},"about_x_years":{"one":"%{count}y"},"over_x_years":{"one":"\u003e %{count}y"},"almost_x_years":{"one":"%{count}y"}},"medium":{"x_minutes":{"one":"%{count} min"},"x_hours":{"one":"%{count} hour"},"x_days":{"one":"%{count} day"}},"medium_with_ago":{"x_minutes":{"one":"%{count} min ago"},"x_hours":{"one":"%{count} hour ago"},"x_days":{"one":"%{count} day ago"},"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}},"later":{"x_days":{"one":"%{count} day later"},"x_months":{"one":"%{count} month later"},"x_years":{"one":"%{count} year later"}}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"%{count} user"}},"groups":{"title":{"one":"Group"}},"categories":{"topic_sentence":{"one":"%{count} topic"},"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"given"},"likes_received":{"one":"received"},"days_visited":{"one":"day visited"},"topics_entered":{"one":"topic viewed"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"local_time":"Local Time","replies_lowercase":{"one":"reply"},"email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?"}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts"},"group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e topic."}}},"topic":{"filter_to":{"one":"%{count} post in topic"},"new_topics":{"one":"%{count} new topic"},"unread_topics":{"one":"%{count} unread topic"},"total_unread_posts":{"one":"you have %{count} unread post in this topic"},"unread_posts":{"one":"you have %{count} unread old post in this topic"},"new_posts":{"one":"there is %{count} new post in this topic since you last read it"},"likes":{"one":"there is %{count} like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"}},"filters":{"n_posts":{"one":"%{count} post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e post."}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view %{count} hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes_title":{"one":"%{count} person liked this post"},"has_likes_title_you":{"one":"you and %{count} other person liked this post"},"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?"}}},"flagging":{"custom_message":{"at_least":{"one":"enter at least %{count} character"},"more":{"one":"%{count} to go..."},"left":{"one":"%{count} remaining"}}},"topic_map":{"clicks":{"one":"%{count} click"}},"post_links":{"title":{"one":"%{count} more"}},"views_lowercase":{"one":"view"},"views_long":{"one":"this topic has been viewed %{count} time"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (%{count})"}},"unread":{"title_with_count":{"one":"Unread (%{count})"},"lower_title_with_count":{"one":"%{count} unread"}},"new":{"lower_title_with_count":{"one":"%{count} new"},"title_with_count":{"one":"New (%{count})"}},"category":{"title_with_count":{"one":"{{categoryName}} (%{count})"}}},"badges":{"earned_n_times":{"one":"Earned this badge %{count} time"},"badge_count":{"one":"%{count} Badge"},"more_badges":{"one":"+%{count} More"},"granted":{"one":"%{count} granted"}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option"}}},"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'ko';
I18n.pluralizationRules.ko = MessageFormat.locale.ko;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var ko = moment.defineLocale('ko', {
        months : '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
        monthsShort : '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
        weekdays : '일요일_월요일_화요일_수요일_목요일_금요일_토요일'.split('_'),
        weekdaysShort : '일_월_화_수_목_금_토'.split('_'),
        weekdaysMin : '일_월_화_수_목_금_토'.split('_'),
        longDateFormat : {
            LT : 'A h:mm',
            LTS : 'A h:mm:ss',
            L : 'YYYY.MM.DD.',
            LL : 'YYYY년 MMMM D일',
            LLL : 'YYYY년 MMMM D일 A h:mm',
            LLLL : 'YYYY년 MMMM D일 dddd A h:mm',
            l : 'YYYY.MM.DD.',
            ll : 'YYYY년 MMMM D일',
            lll : 'YYYY년 MMMM D일 A h:mm',
            llll : 'YYYY년 MMMM D일 dddd A h:mm'
        },
        calendar : {
            sameDay : '오늘 LT',
            nextDay : '내일 LT',
            nextWeek : 'dddd LT',
            lastDay : '어제 LT',
            lastWeek : '지난주 dddd LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s 후',
            past : '%s 전',
            s : '몇 초',
            ss : '%d초',
            m : '1분',
            mm : '%d분',
            h : '한 시간',
            hh : '%d시간',
            d : '하루',
            dd : '%d일',
            M : '한 달',
            MM : '%d달',
            y : '일 년',
            yy : '%d년'
        },
        dayOfMonthOrdinalParse : /\d{1,2}(일|월|주)/,
        ordinal : function (number, period) {
            switch (period) {
                case 'd':
                case 'D':
                case 'DDD':
                    return number + '일';
                case 'M':
                    return number + '월';
                case 'w':
                case 'W':
                    return number + '주';
                default:
                    return number;
            }
        },
        meridiemParse : /오전|오후/,
        isPM : function (token) {
            return token === '오후';
        },
        meridiem : function (hour, minute, isUpper) {
            return hour < 12 ? '오전' : '오후';
        }
    });

    return ko;

})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
