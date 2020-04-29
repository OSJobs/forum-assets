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
r += "還有 ";
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
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 個未讀的話題</a>";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 個未讀的話題</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
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
r += "和 ";
return r;
},
"false" : function(d){
var r = "";
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
r += "/new'>1 個新</a>的話題";
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
r += "和 ";
return r;
},
"false" : function(d){
var r = "";
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
})() + " 個最近</a>的話題";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "可以閱讀，或者";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "瀏覽";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += "中的其他話題";
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
r += "你將刪除該使用者的";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>個貼文";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>個貼文";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>個話題";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>個話題";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "、該帳號，並阻止其IP地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> 再次註冊，並將其郵件地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 加入黑名單。你確定這使用者是廣告散佈者嗎？";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "This topic has ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "你將要刪除 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 個貼文";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 個貼文";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 個話題";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 個話題";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。確定嗎？";
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["zh_TW"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.zh_TW = function ( n ) {
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

I18n.translations = {"zh_TW":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"位元組"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}} 千","millions":"{{number}} 百萬"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","timeline_date":"YYYY年 M月","long_no_year_no_time":"M月 D日","full_no_year_no_time":"M月 D日","long_with_year":"YYYY年 M月 D日 h:mm a","long_with_year_no_time":"YYYY年 M月 D日","full_with_year_no_time":"YYYY年 M月 D日","long_date_with_year":"YYYY年 M月 D日 LT","long_date_without_year":"M月 D日 LT","long_date_with_year_without_time":"YYYY年 M月 D日","long_date_without_year_with_linebreak":"M月 D日 \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"YYYY年 M月 D日\u003cbr/\u003eLT","wrap_ago":"%{date}前","tiny":{"half_a_minute":"\u003c 1 分鐘","less_than_x_seconds":{"other":"\u003c %{count} 秒"},"x_seconds":{"other":"%{count} 秒"},"less_than_x_minutes":{"other":"\u003c %{count} 分鐘"},"x_minutes":{"other":"%{count} 分鐘"},"about_x_hours":{"other":"%{count} 小時"},"x_days":{"other":"%{count} 天"},"x_months":{"other":"%{count} 個月"},"about_x_years":{"other":"%{count} 年"},"over_x_years":{"other":"\u003e %{count} 年"},"almost_x_years":{"other":"%{count} 年"},"date_month":"M月 D日","date_year":"YYYY年 M月"},"medium":{"x_minutes":{"other":"%{count} 分鐘"},"x_hours":{"other":"%{count} 小時"},"x_days":{"other":"%{count} 天"},"date_year":"YYYY年 M月 D日"},"medium_with_ago":{"x_minutes":{"other":"%{count} 分鐘前"},"x_hours":{"other":"%{count} 小時前"},"x_days":{"other":"%{count} 天前"},"x_months":{"other":"%{count} 個月前"},"x_years":{"other":"%{count} 年前"}},"later":{"x_days":{"other":"%{count} 天後"},"x_months":{"other":"%{count} 個月後"},"x_years":{"other":"%{count} 年後"}},"previous_month":"上個月","next_month":"下個月","placeholder":"日期"},"share":{"topic_html":"話題\u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"貼文 #%{postNumber} ","close":"關閉","twitter":"分享連結到Twitter","facebook":"分享連結到Facebook","email":"以電子郵件傳送連結"},"action_codes":{"public_topic":"於 %{when}發佈這個話題","private_topic":"於 %{when} 私訊這個話題","split_topic":"於 %{when} 分割此話題","invited_user":"於 %{when} 邀請 %{who}","invited_group":"於 %{when} 邀請 %{who} ","user_left":"%{who} 已於 %{when} 將自己從此訊息中移除","removed_user":"已於 %{when} 刪除 %{who}","removed_group":"刪除 %{who} %{when}","autobumped":"將於%{when}自動浮上來","autoclosed":{"enabled":"於 %{when} 關閉","disabled":"於 %{when} 開啟"},"closed":{"enabled":"於 %{when} 關閉","disabled":"於 %{when} 開啟"},"archived":{"enabled":"於 %{when} 封存","disabled":"於 %{when} 解除封存"},"pinned":{"enabled":"於 %{when} 置頂","disabled":"於 %{when} 解除置頂"},"pinned_globally":{"enabled":"於 %{when} 全區置頂","disabled":"於 %{when} 解除置頂"},"visible":{"enabled":"於 %{when} 列出","disabled":"於 %{when} 除名"},"banner":{"enabled":"已於 %{when} 將其作為橫幅主題。它將一直顯示直至使用者關閉它。","disabled":"已於 %{when} 移除該橫幅主題。將不再出現於任何頁面。"}},"wizard_required":"是時候配置你的論壇啦！\u003ca href='%{url}' data-auto-route='true'\u003e點擊開始設置嚮導\u003c/a\u003e！","emails_are_disabled":"管理員已停用了全域的外部信件功能。將不再寄出任何類型的電子郵件。","bootstrap_mode_enabled":"為了讓您更輕鬆地建設網站，您正處於初始模式。將會自動授予所有新註冊的使用者信任等級 1，並自動啟用每日摘要電子郵件。該功能將於 %{min_users} 個使用者註冊後自動關閉。","bootstrap_mode_disabled":"初始模式將會在 24 小時後自動禁用。","themes":{"default_description":"預設"},"s3":{"regions":{"ap_northeast_1":"亞太地區 (東京)","ap_northeast_2":"亞太地區 (首爾)","ap_south_1":"亞太地區 (孟買)","ap_southeast_1":"亞太地區 (新加坡)","ap_southeast_2":"亞太地區 (雪梨)","ca_central_1":"加拿大 (中央)","cn_north_1":"中國 (北京)","cn_northwest_1":"中國 (寧夏)","eu_central_1":"歐洲 (法蘭克福)","eu_north_1":"歐洲 (斯德哥爾摩)","eu_west_1":"歐洲 (愛爾蘭)","eu_west_2":"歐洲 (倫敦)","eu_west_3":"歐洲 (巴黎)","sa_east_1":"南美洲 (聖保羅)","us_east_1":"美國東部 (北維珍尼亞州)","us_east_2":"美國東部 (俄亥俄州)","us_gov_east_1":"AWS 政府專用（US-East）","us_west_1":"美國西部 (北加州)","us_west_2":"美國西部 (奧勒岡州)"}},"edit":"編輯此話題的標題與分類","expand":"展開","not_implemented":"抱歉，此功能尚未開放。","no_value":"否","yes_value":"是","submit":"送出","generic_error":"抱歉，發生錯誤。","generic_error_with_reason":"發生錯誤: %{error}","go_ahead":"下一步","sign_up":"註冊","log_in":"登入","age":"已建立","joined":"加入時間","admin_title":"管理員","show_more":"顯示更多","show_help":"選項","links":"連結","links_lowercase":{"other":"鏈結"},"faq":"常見問答","guidelines":"守則","privacy_policy":"隱私權政策","privacy":"隱私","tos":"服務條款","rules":"規則","conduct":"行為準則","mobile_view":"手機版","desktop_view":"電腦版","you":"你","or":"或","now":"就在剛才","read_more":"閱讀更多","more":"更多","less":"較少","never":"永不","every_30_minutes":"每 30 分鐘","every_hour":"每小時","daily":"每天","weekly":"每週","every_month":"每個月","every_six_months":"每半年","max_of_count":"（最大 {{count}}）","alternation":"或","character_count":{"other":"{{count}} 個字元"},"related_messages":{"title":"相關訊息","see_all":"參閱 @%{username} 的 \u003ca href=\"%{path}\"\u003e所有訊息\u003c/a\u003e..."},"suggested_topics":{"title":"推薦的話題","pm_title":"推薦訊息"},"about":{"simple_title":"關於","title":"關於 %{title}","stats":"網站統計數據","our_admins":"我們的管理員","our_moderators":"我們的版主","moderators":"板主","stat":{"all_time":"所有時間","last_7_days":"最近 7","last_30_days":"最近 30"},"like_count":"讚","topic_count":"話題","post_count":"貼文","user_count":"使用者","active_user_count":"活躍使用者","contact":"聯絡我們","contact_info":"若有重大問題或關係到網站的緊急時間，請透過 %{contact_info} 聯絡我們"},"bookmarked":{"title":"書籤","clear_bookmarks":"清除書籤","help":{"bookmark":"點擊以將此話題的第一篇貼文加入書籤","unbookmark":"點擊以移除此話題所有書籤"}},"bookmarks":{"created":"你已將此貼文加上書籤","not_bookmarked":"將此貼文加入書籤","remove":"移除書籤","confirm_clear":"確定要移除該話題上的所有書籤嗎？","save":"儲存","reminders":{"later_today":"今日稍晚","tomorrow":"明天","next_week":"下週","later_this_week":"本週稍晚","next_month":"下個月"}},"drafts":{"resume":"恢復","remove":"移除","new_topic":"新話題草稿","new_private_message":"新私訊草稿","topic_reply":"回覆草稿","abandon":{"confirm":"您已在此話題中打開了另一個草稿。 你確定要放棄嗎？","yes_value":"是的，我要放棄。","no_value":"不，我要保留。"}},"topic_count_latest":{"other":"檢視 {{count}} 則新發佈或更新的話題"},"topic_count_unread":{"other":"檢視 {{count}} 則未讀的討論訊息"},"topic_count_new":{"other":"檢視 {{count}} 則新話題"},"preview":"預覽","cancel":"取消","save":"儲存變更","saving":"正在儲存...","saved":"儲存完畢！","upload":"上傳","uploading":"正在上傳...","uploading_filename":"正在上傳: {{filename}}…","clipboard":"剪貼簿","uploaded":"上傳完畢！","pasting":"正在貼上…","enable":"啟用","disable":"停用","continue":"繼續","undo":"復原","revert":"恢復","failed":"失敗","switch_to_anon":"進入匿名模式","switch_from_anon":"離開匿名模式","banner":{"close":"關閉此橫幅","edit":"編輯此橫幅 \u003e\u003e"},"pwa":{"install_banner":"你希望在此裝置上 \u003ca href\u003e安裝 %{title} 嗎？\u003c/a\u003e"},"choose_topic":{"none_found":"未找到任何話題。"},"choose_message":{"none_found":"沒有訊息"},"review":{"order_by":"排序按照","in_reply_to":"回覆給","explain":{"total":"總計"},"claim_help":{"optional":"您可以聲明此項目以防止其他人審核。","required":"您必須先審核項目才能查看它們。","claimed_by_you":"您已聲明此項目，並可以查看。","claimed_by_other":"此項目只能給\u003cb\u003e{{username}}\u003c/b\u003e來審核。"},"claim":{"title":"聲稱這個話題"},"unclaim":{"help":"刪除此聲明"},"awaiting_approval":"等待審核","delete":"刪除","settings":{"saved":"已儲存","save_changes":"儲存變更","title":"設定"},"moderation_history":"審核歷史","view_all":"查看全部","grouped_by_topic":"按主題分類","none":"沒有要審查的項目","view_pending":"觀看待審核","topic_has_pending":{"other":"本話題中仍有 \u003cb\u003e{{count}}\u003c/b\u003e篇待審核貼文"},"title":"審核","topic":"話題：","filtered_topic":"您已篩選到單個主題中的可審閱內容。","filtered_user":"使用者","show_all_topics":"顯示所有話題","deleted_post":"（貼文已被刪除）","deleted_user":"（使用者已被刪除）","user":{"username":"使用者名稱","email":"電子信箱","name":"名稱","fields":"欄位"},"user_percentage":{"summary":{"other":"{{agreed}}, {{disagreed}}, {{ignored}} (共{{count}}則檢舉)"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}% 忽略"}},"topics":{"topic":"話題","reviewable_count":"次數","reported_by":"回報由","deleted":"[話題已被刪除]","original":"（原始的討論話題）","details":"詳情","unique_users":{"other":"%{count} 使用者"}},"replies":{"other":"{{count}}個回應"},"edit":"編輯","save":"儲存","cancel":"取消","filters":{"type":{"title":"類型","all":"（所有類型）"},"minimum_score":"最低分數：","refresh":"重新整理","status":"狀態","category":"分類","priority":{"medium":"中間的","high":"高"}},"conversation":{"view_full":"查看完整對話"},"scores":{"about":"該分數基於報告者的信任級別，其先前標誌的準確性以及報告的項目的優先級來計算。","score":"分數","date":"日期","type":"類型","status":"狀態","submitted_by":"送出者","reviewed_by":"審核由"},"statuses":{"pending":{"title":"申請中"},"approved":{"title":"已同意"},"rejected":{"title":"被拒絕"},"ignored":{"title":"忽略"},"deleted":{"title":"刪除"}},"types":{"reviewable_flagged_post":{"title":"標記的貼文","flagged_by":"標記由"},"reviewable_queued_post":{"title":"排定的貼文"},"reviewable_user":{"title":"使用者"}},"approval":{"title":"貼文需等待審核","description":"我們已收到您的貼文，但需要先經過版主審核後才會顯示出來。敬請稍後。","pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 篇貼文在等待審核中"},"ok":"確定"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e 開啟了 \u003ca href='{{topicUrl}}'\u003e此話題\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e 開啟了 \u003ca href='{{topicUrl}}'\u003e此話題\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e 回覆 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e 回覆 \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e 回覆了 \u003ca href='{{topicUrl}}'\u003e此話題\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e 回覆了 \u003ca href='{{topicUrl}}'\u003e此話題\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e 提及了 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e 提及了 \u003ca href='{{user2Url}}'\u003e你\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003e你\u003c/a\u003e 提及了 \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"由 \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e 發佈","posted_by_you":"由 \u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e 發佈","sent_by_user":"由 \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e 寄出","sent_by_you":"由 \u003ca href='{{userUrl}}'\u003e你\u003c/a\u003e 寄出"},"directory":{"filter_name":"以使用者名稱過濾","title":"使用者","likes_given":"送出的","likes_received":"收到的","topics_entered":"觀看","topics_entered_long":"瀏覽過的話題","time_read":"閱讀次數","topic_count":"話題","topic_count_long":"話題已開啟","post_count":"回覆","post_count_long":"回覆貼文","no_results":"未找到任何結果。","days_visited":"造訪","days_visited_long":"到訪天數","posts_read":"已讀","posts_read_long":"已讀貼文","total_rows":{"other":"%{count} 個使用者"}},"group_histories":{"actions":{"change_group_setting":"更改群組設定","add_user_to_group":"新增使用者","remove_user_from_group":"移除使用者","make_user_group_owner":"設為擁有者","remove_user_as_group_owner":"撤銷擁有者"}},"groups":{"member_added":"已新增","member_requested":"請求","add_members":{"title":"新增成員","description":"管理這個群組的成員","usernames":"使用者名稱"},"requests":{"title":"請求","reason":"原因","accept":"接受","accepted":"已接受","deny":"拒絕","denied":"被拒絕","undone":"請求未完成","handle":"處理會員申請"},"manage":{"title":"管理","name":"名稱","full_name":"全名","add_members":"新增成員","delete_member_confirm":"確定要從群組「\b%{group}」中移除「%{username}'」嗎？","profile":{"title":"個人檔案"},"interaction":{"title":"互動","posting":"張貼","notification":"通知"},"membership":{"title":"會員身份","access":"存取"},"logs":{"title":"日誌","when":"時間","action":"動作","acting_user":"操作者","target_user":"目標使用者","subject":"主旨","details":"詳情","from":"自","to":"至"}},"public_admission":"允許使用者自由加入群組（需要將群組設為公開瀏覽）","public_exit":"允許使用者自由離開群組","empty":{"posts":"沒有來自該群組成員的貼文。","members":"群組內無成員。","requests":"群組內無任何成員發出請求","mentions":"群組未曾被提及","messages":"無該群組的訊息。","topics":"沒有來自該群組成員的話題。","logs":"無該群組的日誌。"},"add":"新增","join":"加入","leave":"離開","request":"請求","message":"訊息","membership_request_template":"自定當使用者傳送加入要求時顯示的樣板","membership_request":{"submit":"送出請求","title":"請求加入 @%{group_name}","reason":"讓群組擁有者瞭解為何你屬於這個群組"},"membership":"會員身份","name":"名字","group_name":"群組名稱","user_count":"使用者","bio":"關於群組","selector_placeholder":"輸入使用者名稱","owner":"擁有者","index":{"title":"群組","all":"所有群組","empty":"無可見群組。","filter":"依群組類型篩選","owner_groups":"我擁有的群組","close_groups":"已關閉的群組","automatic_groups":"自動群組","automatic":"自動","closed":"不公開","public":"公開","private":"私密","public_groups":"公開群組","automatic_group":"自動群組","close_group":"不公開的群組","my_groups":"我的群組","group_type":"群組類型","is_group_user":"成員","is_group_owner":"擁有者"},"title":{"other":"群組"},"activity":"事件","members":{"title":"成員","filter_placeholder_admin":"使用者名稱或電子郵件","filter_placeholder":"使用者名稱","remove_member":"移除成員","remove_member_description":"從這個群組移除 \u003cb\u003e%{username}\u003c/b\u003e","make_owner":"設為擁有者","make_owner_description":"將 \u003cb\u003e%{username}\u003c/b\u003e 設為這個群組的擁有者","remove_owner":"移除擁有者身份","remove_owner_description":"移除 \u003cb\u003e%{username}\u003c/b\u003e 的擁有者身份","owner":"擁有者"},"topics":"話題","posts":"貼文","mentions":"提及","messages":"訊息","notification_level":"群組訊息的預設通知等級","alias_levels":{"mentionable":"誰可 @提及 此群組？","messageable":"誰可向此群組傳送訊息？","nobody":"沒有人","only_admins":"限管理員","mods_and_admins":"限板主與管理員","members_mods_and_admins":"限群組成員、板主以及管理員","everyone":"所有人"},"notifications":{"watching":{"title":"關注","description":"當貼文有新訊息時會有推播通知，並顯示回覆數"},"watching_first_post":{"title":"關注第一則貼文","description":"您會收到群組新訊息的通知，訊息的回應則不會有通知。"},"tracking":{"title":"追蹤","description":"有人以@提及您或回覆您時會有推播通知，並顯示回覆數。"},"regular":{"title":"一般","description":"當有人通過 @名字 提及你時或回覆你時你會收到通知。"},"muted":{"title":"靜音","description":"您不會收到任何此群組內訊息的推播通知。"}},"flair_url":"頭像圖片","flair_url_placeholder":"（可選）圖片網站或 Font Awesome class","flair_url_description":"請用不小於20×20像素的方形圖片或FontAwesome圖標（可接受的格式包含：“fa-icon”，“far fa-icon”或“fab fa-icon”）。","flair_bg_color":"頭像背景顏色","flair_bg_color_placeholder":"（可選）十六進制色彩值","flair_color":"頭像顏色","flair_color_placeholder":"（可選）十六進制色彩值","flair_preview_icon":"預覽圖示","flair_preview_image":"預覽圖片"},"user_action_groups":{"1":"已按讚","2":"已收到讚","3":"書籤","4":"話題","5":"回覆","6":"回應","7":"提及","9":"引用","11":"編輯","12":"送出的項目","13":"收件匣","14":"等待中","15":"草稿"},"categories":{"all":"所有分類","all_subcategories":"所有","no_subcategory":"無","category":"分類","category_list":"顯示分類列表","reorder":{"title":"重新排序分類","title_long":"重新排序分類列表","save":"儲存順序","apply_all":"套用","position":"位置"},"posts":"貼文","topics":"話題","latest":"最新","latest_by":"最新自","toggle_ordering":"顯示/隱藏排序控制","subcategories":"次分類","topic_sentence":{"other":"%{count} 個話題"},"topic_stat_sentence_week":{"other":"%{count}過去一週的新話題"},"topic_stat_sentence_month":{"other":"%{count}過去一個月的新話題"},"n_more":"分類（%{count} 或更多）…"},"ip_lookup":{"title":"IP 位址查詢","hostname":"伺服器名稱","location":"位置","location_not_found":"（未知）","organisation":"組織","phone":"電話","other_accounts":"使用相同 IP 位置的帳號：","delete_other_accounts":"刪除 %{count} 個","username":"使用者名稱","trust_level":"TL","read_time":"閱讀時間","topics_entered":"已閱讀的話題","post_count":"# 貼文","confirm_delete_other_accounts":"你確定要刪除這些帳號？","powered_by":"使用 \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"已複製"},"user_fields":{"none":"（選擇一個選項）"},"user":{"said":"{{username}}：","profile":"個人檔案","mute":"靜音","edit":"編輯喜好設定","download_archive":{"button_text":"全部下載","confirm":"你確定要下載你的貼文嗎？","success":"已開始下載，下載完畢後將以訊息通知您","rate_limit_error":"每天僅可下載貼文一次，請明天再重試。"},"new_private_message":"新訊息","private_message":"訊息","private_messages":"訊息","user_notifications":{"ignore_duration_title":"忽略計時器","ignore_duration_username":"使用者名稱","ignore_duration_when":"持續時間：","ignore_duration_save":"忽略","ignore_duration_note":"請注意，在忽略時間過期後，將自動忽略所有忽略過的。","ignore_duration_time_frame_required":"請選擇一個有效時間範圍","ignore_no_users":"你沒有被忽略的使用者","ignore_option":"已忽略","ignore_option_title":"您將不會收到與此使用者相關的通知，並且該使用者的所有主題與留言都將被隱藏。","add_ignored_user":"加入...","mute_option":"靜音","mute_option_title":"您將不會收到與此使用者相關的任何通知。","normal_option":"一般","normal_option_title":"如果有人@你或回覆你的帖子，將通知你。"},"activity_stream":"活動","preferences":"偏好設定","feature_topic_on_profile":{"save":"儲存","clear":{"title":"清除"}},"profile_hidden":"該使用者的個人檔案已被設為隱藏。","expand_profile":"展開","collapse_profile":"收合","bookmarks":"書籤","bio":"關於我","invited_by":"邀請人","trust_level":"信任等級","notifications":"通知","statistics":"統計","desktop_notifications":{"label":"即時通知","not_supported":"抱歉，您的瀏覽器不支援桌面通知。","perm_default":"啟用桌面通知","perm_denied_btn":"權限被拒絕","perm_denied_expl":"你拒絶了通知提醒的權限。請在瀏覽器設定中允許桌面通知。","disable":"停用通知","enable":"啟用通知","each_browser_note":"注意：你必須在你使用的所用瀏覽器中更改這個設定。","consent_prompt":"當別人回覆您的貼文時，您想要收到即時通知嗎？"},"dismiss":"忽略","dismiss_notifications":"忽略全部","dismiss_notifications_tooltip":"將所有未讀通知設為已讀","first_notification":"你的第一則通知！選擇以開始。","dynamic_favicon":"在瀏覽器小圖示上顯示計數\bIcon","theme_default_on_all_devices":"在所有裝置上設為預設佈景主題","text_size_default_on_all_devices":"在所有裝置上設為預設文字大小","allow_private_messages":"允許其他使用者寄送個人訊息給我","external_links_in_new_tab":"在新分頁中開啟所有外部連結","enable_quoting":"允許引用劃記文字","change":"修改","moderator":"{{user}} 是板主","admin":"{{user}} 是管理員","moderator_tooltip":"該使用者為板主","admin_tooltip":"該使用者為管理員","silenced_tooltip":"該使用者已被禁言","suspended_notice":"該使用者已被停權至 {{date}}。","suspended_permanently":"該使用者已被停權。","suspended_reason":"原因: ","github_profile":"Github","email_activity_summary":"活動摘要","mailing_list_mode":{"label":"郵件列表模式","enabled":"啟用郵件列表模式","instructions":"此設定將複寫活動摘要。\u003cbr /\u003e\n靜音話題和分類不包含在這些郵件中。\n","individual":"每當有新貼文時，傳送郵件通知給我","individual_no_echo":"除了我的貼文以外，每當有新貼文時，傳送郵件通知給我","many_per_day":"每當有新貼文時，傳送郵件通知給我。（每天約 {{dailyEmailEstimate}} 封）","few_per_day":"每當有新貼文時，傳送郵件通知給我。（每天約 2 封）","warning":"已啟用郵寄名單模式。郵件通知設定已被複寫。"},"tag_settings":"標籤","watched_tags":"已關注","watched_tags_instructions":"自動關注該標籤中的所有話題。您會收到新貼文或新話題的通知，話題旁的數字表示新貼文數。","tracked_tags":"已追蹤","tracked_tags_instructions":"您將會自動追蹤任何含有這些標籤的話題。新貼文數量將顯示在每個話題後。","muted_tags":"靜音","muted_tags_instructions":"您將不會收到任何有這些標籤的新話題通知，它們也不會出現在最新話題列表。","watched_categories":"已關注","watched_categories_instructions":"你將自動關注這些分類中的所有話題。當有新貼文與新話題時，你會收到通知，新貼文的數量也將顯示在話題旁邊。","tracked_categories":"追蹤","tracked_categories_instructions":"你將自動追蹤這些分類中的所有話題。新貼文數量將顯示在話題旁邊。","watched_first_post_categories":"關注第一則貼文","watched_first_post_categories_instructions":"你將會收到這些分類中新話題的第一則貼文的通知。","watched_first_post_tags":"關注第一則貼文","watched_first_post_tags_instructions":"你將會收到這些標籤中新話題的第一則貼文的通知。","muted_categories":"靜音","muted_categories_instructions":"你將不會在收到任何與這些分類中的新話題有關的通知。它們亦不會再出現於分類或最新頁面中。","no_category_access":"板主權限不足，無法使用儲存功能","delete_account":"刪除我的帳號","delete_account_confirm":"你真的要刪除帳號嗎？刪除後將無法還原。","deleted_yourself":"你的帳號已成功刪除","delete_yourself_not_allowed":"若你想刪除你的帳號，請聯絡站方。","unread_message_count":"訊息","admin_delete":"刪除","users":"使用者","muted_users":"靜音","muted_users_instructions":"不顯示來自這些使用者的所有通知。","ignored_users":"忽略","ignored_users_instructions":"不顯示來自這些使用者的所有貼文與通知。","tracked_topics_link":"顯示","automatically_unpin_topics":"當我完整閲讀了話題時自動解除置頂。","apps":"應用","revoke_access":"撤銷許可","undo_revoke_access":"解除撤銷許可","api_approved":"已通過審核：","api_last_used_at":"最近使用於：","theme":"佈景主題","home":"預設首頁","staged":"暫存","staff_counters":{"flags_given":"有幫助的檢舉","flagged_posts":"已檢舉的貼文","deleted_posts":"已刪除的貼文","suspensions":"停權","warnings_received":"警告"},"messages":{"all":"全部","inbox":"收件匣","sent":"送出","archive":"封存","groups":"我的群組","bulk_select":"選擇訊息","move_to_inbox":"移動到收件匣","move_to_archive":"封存","failed_to_move":"移動所選郵件失敗（請檢查網路連線）","select_all":"選擇全部","tags":"標籤"},"preferences_nav":{"account":"帳號","profile":"基本資料","emails":"電子郵件","notifications":"通知","categories":"分類","users":"使用者","tags":"標籤","interface":"界面","apps":"應用"},"change_password":{"success":"( 寄出的郵件 )","in_progress":"( 正在傳送郵件 )","error":"( 錯誤 )","action":"寄出重設密碼的郵件","set_password":"設定密碼","choose_new":"選擇一個新密碼","choose":"選擇一個密碼"},"second_factor_backup":{"title":"二步驟備用碼","regenerate":"重新產生","disable":"禁用","enable":"啟用","enable_long":"啟用備用碼","copied_to_clipboard":"複製至剪貼簿","copy_to_clipboard_error":"複製至剪貼簿時發生錯誤","remaining_codes":"你還剩下 \u003cstrong\u003e{{count}}\u003c/strong\u003e 個可使用的備用碼","codes":{"title":"已產生備用碼","description":"每個備用碼僅可使用一次。請將它們保存在安全且可被找到的地方。"}},"second_factor":{"title":"兩步驟驗證","confirm_password_description":"請確認你的密碼以繼續","name":"名稱","label":"代碼","rate_limit":"嘗試其他驗證代碼前請稍後","enable_description":"使用可支援的 app 掃描此 QR Code（\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003e安卓\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e）並輸入您的認證碼。\n","disable_description":"請從您的應用程式輸入驗證碼","show_key_description":"手動輸入","short_description":"以一次性安全碼保護您的帳號\n","extended_description":"二步驟驗證使用除了密碼外的一次性代碼來加強帳號安全性。可以使用\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e或\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e設備來產生代碼。\n","oauth_enabled_warning":"請注意，一旦啟用二步驟驗證，將自動關閉社群登入。","enforced_notice":"在進入網站前，需啟用兩個步驟驗證以增強帳號安全性","edit":"編輯","security_key":{"register":"註冊","delete":"刪除"}},"change_about":{"title":"修改關於我","error":"修改設定值時發生錯誤"},"change_username":{"title":"修改使用者名稱","confirm":"確定要修改你的使用者名稱嗎？","taken":"抱歉，此使用者名稱已經有人使用。","invalid":"此使用者名稱無效，只能使用數字與英文字母。"},"change_email":{"title":"修改電子郵件地址","taken":"抱歉，此電子郵件地址無效。","error":"修改你的電子郵件地址時發生錯誤，可能此電子郵件地址已經有人使用?","success":"我們已經寄出一封郵件至此電子郵件地址，請遵照說明進行確認。","success_staff":"我們已傳送一封電子郵件至你目前的信箱。請根據確認指示進行操作。"},"change_avatar":{"title":"設定個人資料圖片","letter_based":"系統分配的個人資料圖片","uploaded_avatar":"自訂圖片","uploaded_avatar_empty":"新增一張自訂圖片","upload_title":"上傳你的圖片","image_is_not_a_square":"警告：我們裁切了你的圖片，因為該圖片不是正方形的。"},"change_card_background":{"title":"使用者卡背景","instructions":"背景會被置中，且默認寬度為850px。"},"email":{"title":"電子郵件","primary":"主要電子郵件","secondary":"次要電子郵件","no_secondary":"無次要電子郵件","sso_override_instructions":"單一登入服務提供者可更新電子郵件","instructions":"不會公開顯示","ok":"我們將寄一封確認郵件給您。","invalid":"請輸入有效的電子郵件地址。","authenticated":"你的 Email 已由 {{provider}} 驗證完成。","frequency_immediately":"如果您沒有閱讀過重要通知，我們會立即發送電子郵件給您。","frequency":{"other":"我們只會在您 {{count}} 分鐘內沒有活動時，才會寄送電郵通知給您。"}},"associated_accounts":{"title":"關聯帳號","connect":"連結","revoke":"撤銷","cancel":"取消","not_connected":"（無任何連結）"},"name":{"title":"名稱","instructions":"您的全名 (選填)","instructions_required":"您的匿稱","too_short":"你的匿稱太短。","ok":"你的匿稱符合要求。"},"username":{"title":"使用者名稱","instructions":"獨一、無空格、短的","short_instructions":"其他人可以輸入 @{{username}} 提及你。","available":"你的使用者名稱可以使用。","not_available":"無法使用，請試試看 {{suggestion}}？","not_available_no_suggestion":"不可使用","too_short":"你的使用者名稱太短。","too_long":"你的使用者名稱太長。","checking":"正在檢查使用者名稱是否已經有人使用...","prefilled":"電子郵件地址與此註冊的使用者名稱相符。"},"locale":{"title":"界面語言","instructions":"使用者介面的語言，當頁面重新整理的時候會更換成你的設定。","default":"(default)","any":"任何"},"password_confirmation":{"title":"再次輸入密碼"},"auth_tokens":{"title":"最近使用的裝置","ip":"IP","details":"詳細訊息","log_out_all":"登出所有裝置","active":"目前啟用中的","not_you":"不是你嗎？","show_all":"顯示全部（{{count}}）","show_few":"顯示更少","was_this_you":"這是你嗎？","was_this_you_description":"若這不是你，建議你修改你的密碼並登出所有裝置。","browser_and_device":"{{device}} 上的 {{browser}}","secure_account":"增強我的帳號安全性","latest_post":"最近的貼文…"},"last_posted":"最近發表","last_emailed":"最近寄出電子郵件","last_seen":"出現時間","created":"建立日期","log_out":"登出","location":"位置","website":"網站","email_settings":"電子郵件","hide_profile_and_presence":"隱藏我的公開檔案","enable_physical_keyboard":"支援iPad外接鍵盤","text_size":{"title":"文字大小","smaller":"小","normal":"一般","larger":"大","largest":"最大"},"title_count_mode":{"title":"背景頁面標題顯示計數：","notifications":"新的通知","contextual":"新的頁面內容"},"like_notification_frequency":{"title":"使用者被讚時通知提醒","always":"總是","first_time_and_daily":"每天首個被讚","first_time":"歷史首個被讚","never":"永不"},"email_previous_replies":{"title":"郵件底部包含歷史回覆","unless_emailed":"首次","always":"總是","never":"永不"},"email_digests":{"title":"當我沒瀏覽這裡時，傳送熱門話題與回覆的電子郵件摘要給我","every_30_minutes":"每 30 分鐘","every_hour":"每小時","daily":"每天","weekly":"每週","every_month":"每個月","every_six_months":"每半年"},"email_level":{"title":"當有人引用、回覆我的發文，或以 @使用者名稱 提及我時，請以電子郵件通知我。","always":"總是","only_when_away":"只在離開時","never":"永不"},"email_messages_level":"當有人寄給我私人訊息時，以電子郵件通知我。","include_tl0_in_digests":"摘要郵件中包含新使用者的內容","email_in_reply_to":"郵件中包含回覆你的內容節選","other_settings":"其它","categories_settings":"分類","new_topic_duration":{"label":"視為新話題的條件","not_viewed":"我未看過的討論","last_here":"我上次到訪後的討論","after_1_day":"昨天發佈的討論","after_2_days":"過去兩天發佈的討論","after_1_week":"過去一週發佈的討論","after_2_weeks":"過去兩週發佈的討論"},"auto_track_topics":"自動追蹤我參與的討論","auto_track_options":{"never":"永不","immediately":"立即","after_30_seconds":"30 秒後","after_1_minute":"一分鐘後","after_2_minutes":"兩分鐘後","after_3_minutes":"三分鐘後","after_4_minutes":"四分鐘後","after_5_minutes":"五分鐘後","after_10_minutes":"十分鐘後"},"notification_level_when_replying":"當我在話題中回覆後，將話題設置至","invited":{"search":"輸入要搜尋邀請的文字...","title":"邀請","user":"受邀請的使用者","none":"沒有可顯示的邀請","truncated":{"other":"只顯示前 {{count}} 個邀請。"},"redeemed":"已接受的邀請","redeemed_tab":"接受日期","redeemed_tab_with_count":"接受日期 ({{count}})","redeemed_at":"接受日期","pending":"尚未接受的邀請","pending_tab":"等待中","pending_tab_with_count":"等待中 ({{count}})","topics_entered":"參與的話題","posts_read_count":"已讀的貼文","expired":"此邀請已過期","rescind":"移除","rescinded":"邀請已刪除","rescind_all":"移除所有過期的邀請","rescinded_all":"已移除所有過期的邀請！","rescind_all_confirm":"您是否確定要移除所有過期的邀請？","reinvite":"重送邀請","reinvite_all":"重送所有邀請","reinvite_all_confirm":"您確定要重新寄出所有邀請嗎?","reinvited":"邀請已經重送","reinvited_all":"所有邀請已經重送","time_read":"閱讀時間","days_visited":"到訪天數","account_age_days":"帳號已建立 (天)","create":"送出邀請","generate_link":"拷貝邀請連結","link_generated":"邀請連結生成成功！","valid_for":"邀請連結只對這個郵件地址有效：%{email}","bulk_invite":{"none":"你尚未邀請任何人。你可以發送個別邀請，或者透過\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e上傳大量邀請檔\u003c/a\u003e一次邀請一群人。","text":"從檔案大量邀請","success":"檔案已上傳成功，處理完畢後將以私人訊息通知你。","error":"上傳的檔案必須是 csv 格式。","confirmation_message":"您即將寄email邀請給上傳文件中的所有人。"}},"password":{"title":"密碼","too_short":"你的密碼太短。","common":"此密碼太簡單。","same_as_username":"密碼與使用者名稱相同","same_as_email":"你的密碼與電郵相同。","ok":"你的密碼符合要求。","instructions":"至少 %{count} 個字元"},"summary":{"title":"摘要","stats":"統計","time_read":"閱讀時間","recent_time_read":"最近的閱讀時間","topic_count":{"other":"話題已開啟"},"post_count":{"other":"貼文已建立"},"likes_given":{"other":"已送出"},"likes_received":{"other":"已接收"},"days_visited":{"other":"到訪天數"},"topics_entered":{"other":"已讀話題"},"posts_read":{"other":"讀過的貼文"},"bookmark_count":{"other":"書籤"},"top_replies":"最佳回覆","no_replies":"暫無回覆。","more_replies":"更多回覆","top_topics":"熱門話題","no_topics":"暫無話題。","more_topics":"更多話題","top_badges":"熱門徽章","no_badges":"還沒有徽章。","more_badges":"更多徽章","top_links":"最佳連結","no_links":"暫無連結","most_liked_by":"誰得到最多讚","most_liked_users":"讚誰最多","most_replied_to_users":"最多回覆至","no_likes":"暫無讚","top_categories":"熱門分類","topics":"話題","replies":"回覆"},"ip_address":{"title":"最近的 IP 位址"},"registration_ip_address":{"title":"註冊之 IP 位址"},"avatar":{"title":"個人資料圖片","header_title":"個人頁面、訊息、書籤和設置"},"title":{"title":"頭銜","none":"(無)"},"primary_group":{"title":"主要群組","none":"(無)"},"filters":{"all":"全部"},"stream":{"posted_by":"發表者","sent_by":"寄件者","private_message":"訊息","the_topic":"話題"}},"loading":"正在載入","errors":{"prev_page":"當嘗試載入","reasons":{"network":"網絡錯誤","server":"伺服器錯誤","forbidden":"拒絕存取","unknown":"錯誤","not_found":"找不到頁面"},"desc":{"network":"請檢查你的網絡連線。","network_fixed":"似乎沒有問題了","server":"錯誤代碼：{{status}}","forbidden":"你不允許瀏覽此處。","not_found":"沒有這個頁面","unknown":"發生錯誤。"},"buttons":{"back":"返回","again":"請再試一次","fixed":"載入頁面"}},"modal":{"close":"關閉"},"close":"關閉","assets_changed_confirm":"此網站剛剛已更新，你要重整頁面以獲得最新版本嗎？","logout":"已登出","refresh":"重新整理","read_only_mode":{"enabled":"站點正處於只讀模式。你可以繼續瀏覽，但是回覆、讚和其他操作暫時被禁用。","login_disabled":"在唯讀模式下不能登入","logout_disabled":"站點在只讀模式下無法登出。"},"learn_more":"進一步了解...","all_time":"總數","all_time_desc":"開啟的話題總量","year":"年","year_desc":"最近 365 天內開啟的話題","month":"月","month_desc":"最近 30 天內開啟的話題","week":"週","week_desc":"最近 7 天內開啟的話題","day":"天","first_post":"第一篇貼文","mute":"靜音","unmute":"取消靜音","last_post":"最新貼文","time_read":"已讀","time_read_recently":"最近","time_read_tooltip":"已閱讀 %{time_read}","time_read_recently_tooltip":"%{time_read} 總共閱讀時間 (%{recent_time_read} 在最近 60 天)","last_reply_lowercase":"最新回覆","replies_lowercase":{"other":"回覆"},"signup_cta":{"sign_up":"註冊","hide_session":"明天提醒我","hide_forever":"不了","hidden_for_session":"好的，我會在明天提醒你。不過你隨時都可以使用「登入」來註冊帳號。","intro":"你好！:heart_eyes: 看起來你挺喜歡這樣的討論，可是你還沒有註冊帳號。","value_prop":"當你註冊帳號後，我們可以準確地記錄你的閲讀進度，這樣你能夠在下一次造訪時回到你上次閲讀到的地方。你也可以選擇接受新貼文的網頁和郵件通知，也可以按任何貼文讚來分享你的感謝。:heartbeat:"},"summary":{"enabled_description":"你正在檢視此話題的摘要：在這個社群裡最熱門的貼文。","description":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 個回覆。","description_time":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 個回覆，大約要花 \u003cb\u003e{{readingTime}} 分鐘\u003c/b\u003e閲讀。","enable":"以摘要檢視此話題","disable":"顯示所有貼文"},"deleted_filter":{"enabled_description":"這個話題含有被刪除的回覆，這些回覆已被隱藏。","disabled_description":"話題內刪除的回復已被顯示。","enable":"隱藏已刪除的貼文","disable":"顯示已刪除的貼文"},"private_message_info":{"title":"訊息","invite":"邀請其他人...","edit":"新增或移除…","leave_message":"確定要移除這個訊息嗎？","remove_allowed_user":"確定將 {{name}} 從對話中移除？","remove_allowed_group":"確定將 {{name}} 從對話中移除？"},"email":"電子郵件","username":"使用者名稱","last_seen":"出現時間","created":"已建立","created_lowercase":"已建立","trust_level":"信任等級","search_hint":"使用者名稱、電子郵件、或是IP位址","create_account":{"title":"建立新帳號","failed":"發生了某些錯誤，可能此電子郵件地址已經註冊過，請試試看忘記密碼連結"},"forgot_password":{"title":"寄出密碼","action":"我忘了我的密碼","invite":"請輸入使用者名稱或電子郵件地址，我們將寄給你重設密碼的郵件。","reset":"重設密碼","complete_username":"如果有帳號符合你輸入的使用者名稱 \u003cb\u003e%{username}\u003c/b\u003e，你應該很快就會收到重設密碼的電子郵件。","complete_email":"如果有帳號符合你輸入的電子郵件地址 \u003cb\u003e%{email}\u003c/b\u003e，你應該很快就會收到重設密碼的電子郵件。","complete_username_not_found":"沒有帳號使用 \u003cb\u003e%{username}\u003c/b\u003e 這個使用者名稱","complete_email_not_found":"沒有帳號使用 \u003cb\u003e%{email}\u003c/b\u003e","help":"沒收到信嗎？ 請先檢查您的垃圾信件匣。\u003cp\u003e不確定您使用的是哪個信箱嗎？ 輸入查看該信箱是否已註冊。\u003c/p\u003e\u003cp\u003e如果您已經無法登入您帳號所使用的信箱，請與\u003ca href='%{basePath}/about'\u003e管理員\u003c/a\u003e聯繫。\u003c/p\u003e","button_ok":"確定","button_help":"幫助"},"email_login":{"link_label":"傳送登入連結的email給我","button_label":"透過email","complete_username":"如果帳號符合使用者名稱\u003cb\u003e%{username}\u003c/b\u003e，您很快會收到一封含有登入連結的email。","complete_email":"如果帳號符合\u003cb\u003e%{email}\u003c/b\u003e，您很快會收到一封含有登入連結的email。","complete_username_found":"有一個帳號符合使用者名稱\u003cb\u003e%{username}\u003c/b\u003e，您很快會收到一封含有登入連結的email。","complete_email_found":"有一個帳號符合\u003cb\u003e%{email}\u003c/b\u003e，您很快會收到一封含有登入連結的email。","complete_username_not_found":"沒有符合使用者名稱\u003cb\u003e%{username}\u003c/b\u003e的帳號","complete_email_not_found":"沒有符合\u003cb\u003e%{email}\u003c/b\u003e的帳號","confirm_title":"繼續連接至 %{site_name}"},"login":{"title":"登入","username":"使用者","password":"密碼","second_factor_title":"兩步驟驗證","second_factor_description":"請輸入應用程式中的驗證碼：","second_factor_backup_title":"兩步驟驗證備用","second_factor_backup_description":"請輸入一組您的備用碼","email_placeholder":"電子郵件地址或使用者名稱","caps_lock_warning":"大寫鎖定中","error":"未知的錯誤","rate_limit":"嘗試重新登入前請先等待","blank_username":"請輸入您的電子郵件或使用者名稱。","blank_username_or_password":"請輸入你的電子郵件或者使用者名稱，以及密碼。","reset_password":"重設密碼","logging_in":"登入中...","or":"或","authenticating":"正在驗證...","awaiting_activation":"你的帳號目前尚未啟用，請點選忘記密碼的連結來重新寄出一封認證信。","awaiting_approval":"你的帳號尚未通過工作人員的審核，當審核通過時你會收到電子郵件通知。","requires_invite":"抱歉，只有受邀請者才能進入此論壇。","not_activated":"你還無法登入，我們之前曾將啟用帳號的電子郵件寄至 \u003cb\u003e{{sentTo}}\u003c/b\u003e，請從該電子郵件啟用你的帳號。","not_allowed_from_ip_address":"你無法透過此 IP 登入。","admin_not_allowed_from_ip_address":"你無法透過此 IP 登入成為管理員。","resend_activation_email":"按這裡重新寄出啟用帳號的電子郵件。","omniauth_disallow_totp":"您的帳號已啟用兩步驟驗證。請使用您的密碼登入。","resend_title":"重新寄出認證信","change_email":"更換電子郵件","provide_new_email":"提供新的電子郵件，我們將把認證信重新寄給您。","submit_new_email":"更換電子郵件","sent_activation_email_again":"我們已經將啟用帳號的電子郵件寄至 \u003cb\u003e{{currentEmail}}\u003c/b\u003e，你可能幾分鐘後才會收到，如果一直沒收到，請檢查垃圾郵件資料夾。","sent_activation_email_again_generic":"啟用帳號的電子郵件已寄出 ，你可能幾分鐘後才會收到，如果一直沒收到，請檢查垃圾郵件資料夾。","to_continue":"請登入","preferences":"需要登入後更改設置","forgot":"我不記得帳號詳情了","not_approved":"您的帳號尚未通過審核。一旦您的帳號通過審核，就會傳送電子郵件通知您。","google_oauth2":{"name":"Google","title":"使用 Google 帳號"},"twitter":{"name":"Twitter","title":"使用 Twitter"},"instagram":{"name":"Instagram","title":"用 Instagram 登入"},"facebook":{"name":"Facebook","title":"使用 Facebook"},"github":{"name":"GitHub","title":"使用 GitHub"},"second_factor_toggle":{"totp":"請改用身份驗證應用程式","backup_code":"請改用備用碼"}},"invites":{"accept_title":"邀請函","welcome_to":"歡迎來到 %{site_name}！","invited_by":"您被邀請，來自：","social_login_available":"你也可以透過其他相同 email 的社交帳號登入。","your_email":"您帳號的電郵地址是 \u003cb\u003e%{email}\u003c/b\u003e","accept_invite":"接受邀請","success":"你的帳號已被建立，且您已經登入了。","name_label":"姓名","password_label":"設定密碼","optional_description":"(選擇性)"},"password_reset":{"continue":"繼續連接至 %{site_name}"},"emoji_set":{"apple_international":"Apple/國際化","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"僅分類","categories_with_featured_topics":"有精選話題的分類","categories_and_latest_topics":"分類和最新話題","categories_and_top_topics":"分類與熱門話題","categories_boxes":"子分類欄","categories_boxes_with_topics":"精選話題欄"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"載入中..."},"category_row":{"topic_count":"{{count}}個話題在此分類"},"select_kit":{"default_header_text":"選擇...","no_content":"找不到符合的項目","filter_placeholder":"搜尋...","filter_placeholder_with_any":"搜尋或建立...","create":"建立：'{{content}}'","max_content_reached":{"other":"您只能選擇{{count}}個項目"},"min_content_not_reached":{"other":"至少要選擇{{count}}個項目"}},"date_time_picker":{"from":"自","to":"至"},"emoji_picker":{"filter_placeholder":"搜尋表情符號","smileys_\u0026_emotion":"表情符號","people_\u0026_body":"人們","animals_\u0026_nature":"動物與自然","food_\u0026_drink":"食物和飲料","travel_\u0026_places":"旅行與地點","activities":"活動","objects":"物品","symbols":"象徵\u003cbr\u003e","flags":"檢舉","recent":"最近使用過的","default_tone":"膚色深度：0","light_tone":"膚色深度：1","medium_light_tone":"膚色深度：2","medium_tone":"膚色深度：3","medium_dark_tone":"膚色深度：4","dark_tone":"膚色深度：5","default":"自訂表情符號"},"shared_drafts":{"title":"共享草稿","notice":"\b只有能瀏覽\u003cb\u003e{{category}}\u003c/b\u003e分類的使用者能看到這個話題","destination_category":"指定分類","publish":"發佈共享草稿","confirm_publish":"您確定要發佈這份草稿嗎？","publishing":"話題發佈中⋯⋯"},"composer":{"emoji":"表情符號 :)","more_emoji":"更多...","options":"選項","whisper":"密談","unlist":"不公開","blockquote_text":"塊引用","add_warning":"這是正式警告。","toggle_whisper":"切換密談","toggle_unlisted":"切換 不公開","posting_not_on_topic":"你想要回覆哪個話題?","saved_local_draft_tip":"本地儲存完畢","similar_topics":"與你的話題類似的討論...","drafts_offline":"離線草稿","edit_conflict":"編輯衝突","group_mentioned_limit":"\u003cb\u003e提醒\u003c/b\u003e你提及了\u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e，但此群組的人數多於管理員配置的提及人數上限（{{max}}位），因此不會有任何人收到通知。","group_mentioned":{"other":"提及 {{group}} 時，你將通知 \u003ca href='{{group_link}}'\u003e{{count}} 人\u003c/a\u003e － 確定嗎？"},"cannot_see_mention":{"category":"您提及了{{userrname}}，但他們不能進入該分類，所以他們不會收到通知。您必須把他們加入到有權限進入該分類的群組中。","private":"您提及了{{username}}，但他們不能看到私人訊息，所以他們不會收到通知。您必須把他們邀請至私訊對話中。"},"duplicate_link":"您連到\u003cb\u003e{{domain}}\u003c/b\u003e的連結已被\u003cb\u003e@{{username}}\u003c/b\u003e\u003ca href='{{post_url}}'\u003e於{{ago}}前發在其他話題下的回覆\u003c/a\u003e，確定要再次發佈嗎？","error":{"title_missing":"標題為必填欄位","title_too_short":"標題必須至少 {{min}} 個字","title_too_long":"標題不能超過 {{max}} 個字","post_length":"貼文必須至少 {{min}} 個字。","try_like":"您用過{{heart}}了嗎？","category_missing":"你必須選擇一個分類。","tags_missing":"您至少必須選擇{{count}}個標籤"},"save_edit":"儲存編輯","overwrite_edit":"覆寫編輯","reply_original":"回覆至原始的話題","reply_here":"在此回覆","reply":"回覆","cancel":"取消","create_topic":"開啟話題","create_pm":"訊息","create_whisper":"悄悄話","create_shared_draft":"建立共享草稿","edit_shared_draft":"編輯共享草稿","title":"或者按 Ctrl+Enter","users_placeholder":"新增使用者","title_placeholder":"用一個簡短的句子來描述想討論的內容。","title_or_link_placeholder":"鍵入標題，或貼上一個連結在這裡","edit_reason_placeholder":"你為什麼做編輯?","topic_featured_link_placeholder":"在標題裡輸入連結","remove_featured_link":"移除標題裡的連結","reply_placeholder":"在這裡輸入內文，可以使用 Markdown、BBCode 或 HTML 來格式化文字，也可以拖曳或貼上圖片。","reply_placeholder_no_images":"在這裡輸入內文，可以使用 Markdown、BBCode 或 HTML 來格式化文字。","reply_placeholder_choose_category":"輸入前，必須先選擇分類","view_new_post":"檢視你的新貼文。","saving":"正在儲存","saved":"儲存完畢!","uploading":"正在上傳...","show_preview":"顯示預覽 \u0026raquo;","hide_preview":"\u0026laquo; 隱藏預覽","quote_post_title":"引用完整貼文","bold_label":"B","bold_title":"粗體","bold_text":"粗體字","italic_label":"I","italic_title":"斜體","italic_text":"斜體字","link_title":"超連結","link_description":"在此輸入超連結的描述","link_dialog_title":"插入超連結","link_optional_text":"標題 (可選填)","quote_title":"引用","quote_text":"引用","code_title":"預先格式化文字","code_text":"以 4 格空白將文字縮排","paste_code_text":"輸入或貼上代碼","upload_title":"上傳","upload_description":"在此輸入上傳的描述","olist_title":"編號清單","ulist_title":"符號清單","list_item":"清單項目","toggle_direction":"切換方向","help":"Markdown 編輯說明","collapse":"縮小編輯版面","open":"打開編輯版面","abandon":"關閉編輯並放棄草稿","enter_fullscreen":"進入全螢幕編輯","exit_fullscreen":"離開全螢幕編輯","modal_ok":"確定","modal_cancel":"取消","cant_send_pm":"抱歉，你不能發訊息給 %{username} 。","yourself_confirm":{"title":"忘記填收信人了嗎？","body":"目前訊息只有發給你自己！"},"admin_options_title":"此話題可選用之工作人員設定選項","composer_actions":{"reply":"回覆","draft":"草稿","edit":"編輯","reply_to_post":{"label":"回應%{postUsername}的 %{postNumber}貼文","desc":"回應特定貼文"},"reply_as_new_topic":{"label":"以「連結話題」回應","desc":"創立新話題來連結此話題"},"reply_as_private_message":{"label":"新增訊息","desc":"寫一則私訊"},"reply_to_topic":{"label":"回應話題","desc":"回應本話題而非特定貼文"},"toggle_whisper":{"label":"切換為悄悄話","desc":"悄悄話只有管理員能見"},"create_topic":{"label":"新增話題"},"shared_draft":{"label":"共享草稿","desc":"建立只有管理員可見的話題草稿"},"toggle_topic_bump":{"label":"回應但不讓貼文浮上來","desc":"回覆而不改變最新回應日期"}},"details_title":"摘要"},"notifications":{"tooltip":{"regular":{"other":"{{count}}則未讀通知"},"message":{"other":"{{count}}則未讀訊息"}},"title":"當有人以「@使用者名稱」提及您、回覆您的貼文、或是傳送訊息給您的時候通知您的設定。","none":"目前無法載入通知。","empty":"未找到任何通知。","post_approved":"你的貼文已通過","reviewable_items":"需要審查的項目","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}、{{username2}}\u003c/span\u003e {{description}}","liked_many":{"other":"\u003cspan\u003e{{username}}、{{username2}} 和其他 {{count}} 個人都\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"other":"說你的{{count}}則貼文讚"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e 接受了您的邀請","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e 移動 {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"得到 '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003e新話題\u003c/span\u003e {{description}}","group_message_summary":{"other":"您的收件匣中有{{count}}則訊息"},"popup":{"mentioned":"{{username}}在“{{topic}}”提及了你 - {{site_title}}","group_mentioned":"{{username}}在“{{topic}}”提及了你 - {{site_title}}","quoted":"{{username}}在“{{topic}}”引用了你的貼文 - {{site_title}}","replied":"{{username}}在“{{topic}}”回覆了你 - {{site_title}}","posted":"{{username}}在“{{topic}}”中發佈了貼文 - {{site_title}}","private_message":"{{username}} 在 \"{{topic}}\" 中私訊了你- {{site_title}}","linked":"{{username}}在“{{topic}}”中連結了你的貼文 - {{site_title}}","watching_first_post":"{{username}} 在 \"{{topic}}\"中開啟了新話題 - {{site_title}}","confirm_title":"通知已啟用-%{site_title}","confirm_body":"成功! 通知已啟用","custom":"新的通知由{{username}}在%{site_title}"},"titles":{"liked":"新的讚","watching_first_post":"新話題","liked_consolidated":"新的讚","post_approved":"貼文已通過審核"}},"upload_selector":{"title":"加入圖片","title_with_attachments":"加入圖片或檔案","from_my_computer":"從我的電腦","from_the_web":"從網站","remote_tip":"圖片連結","remote_tip_with_attachments":"連結到圖片或檔案 {{authorized_extensions}}","local_tip":"從你的裝置中選擇圖片","local_tip_with_attachments":"從裝置選取圖片或檔案 ({{authorized_extensions}})","hint":"(你也可以將檔案拖放至編輯器直接上傳)","hint_for_supported_browsers":"可以拖放或複製粘帖至編輯器以上傳","uploading":"正在上傳","select_file":"選取檔案","default_image_alt_text":"圖片"},"search":{"sort_by":"排序","relevance":"最相關","latest_post":"最新貼文","latest_topic":"最新話題","most_viewed":"最多閱覽人次","most_liked":"最多讚","select_all":"選擇全部","clear_all":"清除全部","too_short":"你的搜尋詞語太短。","result_count":{"other":"關於\u003cspan class='term'\u003e{{term}}\u003c/span\u003e的\u003cspan\u003e{{count}}{{plus}} 個結果 \u003c/span\u003e"},"title":"搜尋話題、貼文、使用者或分類","full_page_title":"搜尋話題或貼文","no_results":"未找到任何結果。","no_more_results":"沒有找到更多的結果。","searching":"正在搜尋...","post_format":"#{{post_number}} {{username}}","results_page":"'{{term}}' 的搜尋結果","more_results":"還有更多結果。請嘗試縮小搜尋條件。","cant_find":"找不到你想找的嗎？","start_new_topic":"或許你可以開啟一個新的話題？","or_search_google":"或是嘗試利用 Google 搜尋:","search_google":"嘗試利用 Google 搜尋:","search_google_button":"Google","search_google_title":"搜尋這個網站","context":{"user":"搜尋 @{{username}} 的貼文","category":"搜索 #{{category}} 分類","topic":"搜尋此話題","private_messages":"搜尋訊息"},"advanced":{"title":"進階搜尋","posted_by":{"label":"發文者"},"in_category":{"label":"已分類"},"in_group":{"label":"在群組中"},"with_badge":{"label":"有徽章"},"with_tags":{"label":"已標記"},"filters":{"label":"只返回主題或張貼的文章...","title":"只有標題吻合","likes":"我按了讚的","posted":"我發了文的","watching":"我正在關注","tracking":"我正在追蹤","private":"在我的訊息","bookmarks":"我加入書籤的","first":"是第一篇文","pinned":"是置頂的","unpinned":"不是置頂的","seen":"我已讀的","unseen":"我還未讀的","wiki":"是公共編輯的","images":"包含圖片","all_tags":"以上所有的標籤"},"statuses":{"label":"當話題","open":"是開放的","closed":"是關閉的","archived":"已經封存的","noreplies":"沒有回覆","single_user":"只有一個使用者參與"},"post":{"count":{"label":"最少貼文數"},"time":{"label":"發表於","before":"之前","after":"之後"}}}},"hamburger_menu":"轉到另一個話題列表或分類","new_item":"新增","go_back":"返回","not_logged_in_user":"使用者頁面（包含目前活動及喜好的摘要）","current_user":"到你的使用者頁面","view_all":"查看全部","topics":{"new_messages_marker":"上次到訪","bulk":{"select_all":"選擇全部","clear_all":"清除全部","unlist_topics":"未在列表中的話題","relist_topics":"討論話題","reset_read":"重設閱讀","delete":"刪除話題","dismiss":"忽略","dismiss_read":"忽略所有未讀話題","dismiss_button":"忽略...","dismiss_tooltip":"僅忽略新貼文或停止追蹤話題","also_dismiss_topics":"停止追蹤這些話題，這樣這些話題就不再顯示為未讀了","dismiss_new":"設定新貼文為已讀","toggle":"批次切換選擇話題","actions":"批次操作","change_category":"設定分類","close_topics":"關閉話題","archive_topics":"已封存的話題","notification_level":"通知","choose_new_category":"為話題選擇新類別：","selected":{"other":"你已選擇了 \u003cb\u003e{{count}}\u003c/b\u003e 個話題。"},"change_tags":"取代標籤","append_tags":"添加標籤","choose_new_tags":"為話題選擇新標籤","choose_append_tags":"為話題選擇新標籤","changed_tags":"話題的標籤已修改"},"none":{"unread":"沒有未讀的話題。","new":"沒有新的話題。","read":"你尚未閱讀任何話題。","posted":"你尚未在任何話題裡發表貼文。","latest":"沒有最近的話題。真令人難過。","bookmarks":"您目前沒有把任何話題加入書籤。","category":"沒有 {{category}} 的話題。","top":"沒有精選話題。","educate":{"new":"\u003cp\u003e這裡顯示了近期話題列表。\u003c/p\u003e\u003cp\u003e預設情況下，以下話題將顯示在近期列表。如果是最近 2 天內開啟的，還會顯示一個\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003e近期\u003c/span\u003e標誌。\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e使用者設置\u003c/a\u003e中更改要顯示哪些內容。\u003c/p\u003e","unread":"\u003cp\u003e這裡顯示你的未讀話題。\u003c/p\u003e\u003cp\u003e預設情況下，下述話題會被放在未讀中。並且會在旁邊顯示未讀的數量\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e。如果你：\u003c/p\u003e\u003cul\u003e\u003cli\u003e開啟了該話題\u003c/li\u003e\u003cli\u003e回覆了該話題\u003c/li\u003e\u003cli\u003e閲讀該話題超過 4 分鐘\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e或者你在話題底部的通知控制中選擇了追蹤或關注。\u003c/p\u003e\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e使用者設置\u003c/a\u003e中修改未讀設置。\u003c/p\u003e"}},"bottom":{"latest":"已經沒有其它最近的話題了。","posted":"已經沒有其它話題了。","read":"已經沒有其它已讀的話題了。","new":"已經沒有其它新話題了。","unread":"已經沒有其它未讀的話題了。","category":"{{category}} 分類已經沒有其它話題了。","top":"沒有更多精選話題。","bookmarks":"書籤裡沒有更多的話題了。"}},"topic":{"filter_to":{"other":"本話題中的 {{count}} 帖"},"create":"新話題","create_long":"開啟新話題","open_draft":"開啟草稿","private_message":"發送訊息","archive_message":{"help":"把訊息移動到封存匣","title":"封存"},"move_to_inbox":{"title":"移動到收件匣","help":"把訊息移動到收件匣"},"edit_message":{"help":"編輯這個訊息的第一篇貼文","title":"編輯訊息"},"defer":{"title":"延遲"},"list":"話題","new":"新話題","unread":"未讀","new_topics":{"other":"{{count}} 個新話題"},"unread_topics":{"other":"{{count}} 個未讀話題"},"title":"話題","invalid_access":{"title":"私人話題","description":"抱歉，你沒有進入此話題的權限","login_required":"你需要登入才能看見這個話題。"},"server_error":{"title":"話題載入失敗","description":"抱歉，可能因為連線有問題而無法載入此話題，請再試一次，如果這個問題持續發生，請讓我們知道。"},"not_found":{"title":"未找到話題","description":"抱歉，找不到此話題，可能已被板主刪除。"},"total_unread_posts":{"other":"你有 {{count}} 個未讀的貼文在這話題內"},"unread_posts":{"other":"你有 {{count}} 個未讀的舊貼文在討論內"},"new_posts":{"other":"自你上次閱讀後，此話題又多了 {{count}} 篇新貼文"},"likes":{"other":"此話題收到了 {{count}} 個讚"},"back_to_list":"回到話題列表","options":"話題選項","show_links":"在話題裡顯示連結","toggle_information":"切換話題詳情","read_more_in_category":"要閱讀更多貼文嗎? 瀏覽 {{catLink}} 裡的話題或 {{latestLink}}。","read_more":"要閱讀更多貼文嗎? 請按 {{catLink}} 或 {{latestLink}}。","browse_all_categories":"瀏覽所有分類","view_latest_topics":"檢視最近的貼文","suggest_create_topic":"開啟一個新話題吧？","jump_reply_up":"跳到更早的回覆","jump_reply_down":"跳到更晚的回覆","deleted":"此話題已被刪除","topic_status_update":{"title":"話題計時器","save":"設定計時器","num_of_hours":"時數：","remove":"移除計時器","publish_to":"發佈至：","when":"當：","public_timer_types":"話題計時器","private_timer_types":"使用者話題計時器","time_frame_required":"請選擇一個有效時間範圍"},"auto_update_input":{"none":"選擇有效時間範圍","later_today":"今日稍晚","tomorrow":"明天","later_this_week":"本週稍晚","this_weekend":"這週末","next_week":"下週","two_weeks":"兩週","next_month":"下個月","two_months":"兩個月","three_months":"三個月","four_months":"四個月","six_months":"六個月","one_year":"一年","forever":"永久","pick_date_and_time":"挑選日期與時間","set_based_on_last_post":"依照上一篇貼文來關閉"},"publish_to_category":{"title":"定時發表"},"temp_open":{"title":"暫時開啟"},"auto_reopen":{"title":"自動開啟話題"},"temp_close":{"title":"暫時關閉"},"auto_close":{"title":"自動關閉話題","label":"自動關閉話題的期限:","error":"請輸入一個有效的值。","based_on_last_post":"在最後一個文章發表後，不自動關閉話題。"},"auto_delete":{"title":"自動刪除話題"},"auto_bump":{"title":"自動上浮話題"},"reminder":{"title":"提醒我"},"status_update_notice":{"auto_open":"此話題將在%{timeLeft}後自動開啟","auto_close":"此話題將在%{timeLeft}後自動關閉","auto_publish_to_category":"這個話題會被發佈到\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e%{timeLeft}。","auto_close_based_on_last_post":"這個話題在最後一個回覆後%{duration}將關閉。","auto_delete":"這個話題將會被自動刪除%{timeLeft}。","auto_bump":"話題在%{timeLeft}後會自動浮上來","auto_reminder":"您會收到關於這個話題的提醒%{timeLeft}。"},"auto_close_title":"自動關閉設定","auto_close_immediate":{"other":"話題中的最後一帖是 %{hours} 小時前發出的，所以話題將會立即關閉。"},"timeline":{"back":"返回","back_description":"回到最後一個未讀貼文","replies_short":"%{current} / %{total}"},"progress":{"title":"topic progress","go_top":"頂部","go_bottom":"底部","go":"前往","jump_bottom":"跳至最後一則貼文","jump_prompt":"跳到...","jump_prompt_of":"%{count} 貼文","jump_bottom_with_number":"跳至第 %{post_number} 篇貼文","jump_prompt_to_date":"至今","jump_prompt_or":"或","total":"所有貼文","current":"目前的貼文"},"notifications":{"title":"改變你收到該話題通知的頻率","reasons":{"mailing_list_mode":"郵件列表模式已啟用，將以郵件通知你關於該話題的回覆。","3_10":"因為你正關注該話題上的標籤，你將會收到通知。","3_6":"你將會收到通知，因為你正在關注此分類。","3_5":"你將會收到通知，因為你自動關注此話題。","3_2":"你將收到關於此話題的通知，因為你正在關注此話題。","3_1":"你將收到關於此話題的通知，因為你開啟了此話題。","3":"你將收到關於此話題的通知，因為你正在關注此話題。","2_8":"您將會看到新回覆的數量，因為你正在追蹤這個分類。","2_4":"您將會看到新回覆的數量，因為你回覆了此話題。","2_2":"您將會看到新回覆的數量，因為你正在追蹤這個話題。","2":"您將會看到新回覆的數量，因為你\u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003e看過這個話題\u003c/a\u003e。","1_2":"如果有人@你或回覆你，將通知你。","1":"如果有人@你或回覆你，將通知你。","0_7":"你正忽略此分類中的所有通知。","0_2":"你正忽略此話題的所有通知。","0":"你正忽略此話題的所有通知。"},"watching_pm":{"title":"關注中","description":"訊息有新回覆時提醒我，並顯示新回覆數量。"},"watching":{"title":"關注","description":"在此話題裡，每一個新回覆將通知你，還將顯示新回覆的數量。"},"tracking_pm":{"title":"追蹤","description":"在訊息標題後顯示新回覆數量。你只會在別人@你或回覆你的貼文時才會收到通知。"},"tracking":{"title":"追蹤","description":"將為該話題顯示新回覆的數量。如果有人@你或回覆你，將通知你。"},"regular":{"title":"一般","description":"如果有人@你或回覆你，將通知你。"},"regular_pm":{"title":"一般","description":"如果有人@你或回覆你，將通知你。"},"muted_pm":{"title":"靜音","description":"你將不會再收到關於此訊息的通知。"},"muted":{"title":"靜音","description":"你不會收到此話題的任何通知，它也不會出現在“最新”話題列表。"}},"actions":{"title":"操作","recover":"復原已刪除的話題","delete":"刪除話題","open":"開放話題","close":"關閉話題","multi_select":"選擇貼文","timed_update":"設定話題計時器","pin":"置頂話題","unpin":"取消置頂話題","unarchive":"復原已封存的話題","archive":"封存話題","invisible":"不出現在列表上","visible":"出現在列表上","reset_read":"重置讀取資料","make_public":"設置為公共話題","make_private":"設置為私訊","reset_bump_date":"重設上浮日期"},"feature":{"pin":"置頂話題","unpin":"取消置頂話題","pin_globally":"全區置頂話題","make_banner":"話題橫幅","remove_banner":"移除話題橫幅"},"reply":{"title":"回覆","help":"開始編寫對此話題的回覆"},"clear_pin":{"title":"取消置頂","help":"取消話題的置頂狀態。"},"share":{"title":"分享","extended_title":"分享連結","help":"分享此話題的連結"},"print":{"title":"列印","help":"打開此討論話題列印友善的版本"},"flag_topic":{"title":"檢舉","help":"檢舉此話題，或以私訊通知管理員","success_message":"已檢舉此話題。"},"feature_topic":{"title":"擁有這個話題","pin":"將該話題置於{{categoryLink}}分類最上方至","confirm_pin":"已有{{count}}個置頂話題。太多的置頂話題可能會困擾新使用者和訪客。確定想在該分類再置頂一個話題？","unpin":"取消此話題在{{categoryLink}}類別的置頂狀態","unpin_until":"從{{categoryLink}}分類最上方移除話題或者移除於\u003cstrong\u003e%{until}\u003c/strong\u003e。","pin_note":"允許使用者取消置頂。","pin_validation":"置頂該話題需要一個日期。","not_pinned":"沒有話題被釘選在 {{categoryLink}} .","already_pinned":{"other":"{{categoryLink}}分類的置頂話題數：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"將話題置於所有話題列表最上方至","confirm_pin_globally":"已有{{count}}個全局置頂話題。太多的置頂話題可能會困擾新使用者和訪客。確定想再全局置頂一個話題？","unpin_globally":"將話題從所有話題列表的最上方移除。","unpin_globally_until":"從所有話題列表最上方移除話題或者移除於\u003cstrong\u003e%{until}\u003c/strong\u003e。","global_pin_note":"允許使用者取消全局置頂。","not_pinned_globally":"沒有全局置頂的話題。","already_pinned_globally":{"other":"全局置頂的話題數：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"將話題設置為出現在所有頁面頂端的橫幅話題。","remove_banner":"移除所有頁面頂端的橫幅主題。","banner_note":"使用者能點擊關閉隱藏橫幅。且只能設置一個橫幅話題。","no_banner_exists":"沒有橫幅話題。","banner_exists":"當前\u003cstrong class='badge badge-notification unread'\u003e設置\u003c/strong\u003e了橫幅話題。"},"inviting":"正在邀請...","automatically_add_to_groups":"邀請將把使用者加入群組：","invite_private":{"title":"邀請訊息交流","email_or_username":"受邀請者的電子郵件地址或使用者名稱","email_or_username_placeholder":"電子郵件地址或使用者名稱","action":"邀請","success":"成功邀請了使用者至該對話","success_group":"成功邀請了群組至該對話","error":"抱歉，向此使用者發出邀請時發生錯誤。","group_name":"群組名稱"},"controls":"話題控件","invite_reply":{"title":"邀請","username_placeholder":"使用者名稱","action":"送出邀請","help":"通過電子郵件或通知邀請其他人到該話題","to_forum":"我們將向你的朋友發出一封電子郵件，他不必登入，他只要按電子郵件裡的連結就可以加入此論壇。","sso_enabled":"輸入其使用者名，邀請其人到本話題。","to_topic_blank":"輸入你想邀請的使用者的使用者名稱或電子郵件地址到該話題","to_topic_email":"你輸入了郵箱地址。我們將發送一封郵件邀請，讓你的朋友可直接回覆該話題。","to_topic_username":"你輸入了使用者名。我們將發送一個至該話題連結的邀請通知。","to_username":"輸入你想邀請的人的使用者名。我們將發送一個至該話題連結的邀請通知。","email_placeholder":"電子郵件地址","success_email":"我們發了一封郵件邀請\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e。邀請被接受後你會收到通知。檢查使用者頁中的邀請標籤頁來追蹤你的邀請。","success_username":"我們已經邀請該使用者加入此話題討論","error":"抱歉，我們不能邀請這個人。可能他已經被邀請了？（邀請有頻率限制）","success_existing_email":"已經有一個有此電子郵件 \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e 的使用者存在。我們已邀請那位使用者來參與這個話題。"},"login_reply":"登入以發表回應","filters":{"n_posts":{"other":"{{count}} 則貼文"},"cancel":"取消過濾"},"move_to":{"title":"移動到","action":"移動到","error":"移動貼文時發生錯誤"},"split_topic":{"title":"移至新話題","action":"移至新話題","topic_name":"新增話題標題","radio_label":"新話題","error":"將話題移至新話題時發生錯誤。","instructions":{"other":"你即將開啟一個新話題，並填入 \u003cb\u003e{{count}}\u003c/b\u003e 篇你已選擇的貼文。"}},"merge_topic":{"title":"移至已存在的話題","action":"移至已存在的話題","error":"將話題移至已存在的話題時發生錯誤。","radio_label":"已存在的話題","instructions":{"other":"請選擇你想將那 \u003cb\u003e{{count}}\u003c/b\u003e 篇貼文移至哪一個話題。"}},"move_to_new_message":{"title":"移動到新訊息","action":"移動到新訊息","message_title":"新訊息標題","radio_label":"新訊息","participants":"參與者","instructions":{"other":"你即將開啟一個新話題，並填入 \u003cb\u003e{{count}}\u003c/b\u003e 篇你已選擇的貼文。"}},"move_to_existing_message":{"title":"移動到已存在的訊息","action":"移動到已存在的訊息","radio_label":"已存在的訊息","participants":"參與者","instructions":{"other":"請選擇你想將那 \u003cb\u003e{{count}}\u003c/b\u003e 篇貼文移至哪一個話題。"}},"merge_posts":{"title":"合併選擇的貼文","action":"合併選擇的貼文","error":"合併選擇的貼文試出錯。"},"change_owner":{"title":"變更擁有者","action":"變更擁有者","error":"修改貼文擁有者時發生錯誤。","placeholder":"新擁有者的使用者名稱","instructions":{"other":"請替\u003cb\u003e@{{old_user}}\u003c/b\u003e的{{count}}篇貼文選擇新的擁有者。"}},"change_timestamp":{"title":"變更時間標籤...","action":"變更時間戳記","invalid_timestamp":"時間戳記不能為將來的時刻。","error":"更改話題時間時發生錯誤。","instructions":"請為話題選擇新的時間。話題中的所有貼文將按照相同的時間差更新。"},"multi_select":{"select":"選取","selected":"選取了 ({{count}})","select_post":{"label":"選擇","title":"將貼文加入選取清單"},"selected_post":{"label":"已選取","title":"點擊後將文章移除"},"select_replies":{"label":"選取＋回覆","title":"將貼文及所有回覆加入選取列表"},"select_below":{"label":"選取 + 底下","title":"將此貼文及其所有以下貼文加入選取列表"},"delete":"刪除選取的貼文","cancel":"取消選取","select_all":"選擇全部","deselect_all":"取消選取","description":{"other":"你已選擇了 \u003cb\u003e{{count}}\u003c/b\u003e 篇貼文。"}},"deleted_by_author":{"other":"（主題已被作者撤回，將在%{count}小時內自動刪除，若有標記便不會刪除）"}},"post":{"quote_reply":"引用","edit_reason":"原因: ","post_number":"貼文 {{number}}","ignored":"忽略內容","wiki_last_edited_on":"共筆最後編輯時間","last_edited_on":"貼文最近編輯的時間","reply_as_new_topic":"回覆為關連的話題","reply_as_new_private_message":"回覆作為新訊息給同一收件人","continue_discussion":"繼續 {{postLink}} 的討論:","follow_quote":"跳到引用的貼文","show_full":"顯示所有貼文","show_hidden":"查看忽略內容","deleted_by_author":{"other":"( 貼文已被作者撤回，除非被檢舉，否則在 %{count} 小時內將自動刪除。)"},"collapse":"收起","expand_collapse":"展開/收合","locked":"管理員已鎖定此貼文，目前無法編輯","gap":{"other":"檢視 {{count}} 則隱藏回應"},"notice":{"new_user":"這是{{user}}第一次發表貼文，一起歡迎他加入我們的社群！","returning_user":"{{user}}已經有一陣子沒出現了—— 他最後一次發文是在{{time}}。"},"unread":"貼文未讀","has_replies":{"other":"{{count}} 個回覆"},"has_likes_title":{"other":"{{count}} 個使用者對此貼文讚好"},"has_likes_title_only_you":"你已按讚","has_likes_title_you":{"other":"你和其他 {{count}} 人讚了該貼"},"errors":{"create":"抱歉，建立你的貼文時發生錯誤，請再試一次。","edit":"抱歉，編輯你的貼文時發生錯誤，請再試一次。","upload":"抱歉，上傳你的檔案時發生錯誤，請再試一次。","file_too_large":"檔案過大（最大 {{max_size_kb}}KB）。為什麼不就大檔案上傳至雲存儲服務後再分享連結呢？","too_many_uploads":"抱歉，一次只能上傳一個檔案。","too_many_dragged_and_dropped_files":"抱歉，您一次最多只能上傳{{max}}個檔案。","upload_not_authorized":"抱歉，你沒有上傳檔案的權限 (驗證擴展：{{authorized_extensions}})。","image_upload_not_allowed_for_new_user":"抱歉，新使用者不可上傳圖片。","attachment_upload_not_allowed_for_new_user":"抱歉，新使用者不可上傳附件。","attachment_download_requires_login":"抱歉，您必須登入以下載附件。"},"abandon_edit":{"no_value":"不，我要保留。"},"abandon":{"confirm":"你確定要捨棄你的貼文嗎?","no_value":"否","yes_value":"是"},"via_email":"本貼文透過電子郵件送達","via_auto_generated_email":"通過自動生成郵件發表的貼文","whisper":"這貼文是版主私人密談","wiki":{"about":"這篇貼文是共筆"},"archetypes":{"save":"儲存選項"},"few_likes_left":"謝謝你的熱情！你今天的讚快用完了。","controls":{"reply":"開始編寫對此貼文的回覆","like":"給此貼文按讚","has_liked":"你已對此貼文按讚","undo_like":"撤回讚","edit":"編輯此貼文","edit_action":"編輯","edit_anonymous":"抱歉，您必須登入以修改貼文。","flag":"檢舉此貼文或傳送私人通知","delete":"刪除此貼文","undelete":"復原此貼文","share":"分享此貼文的連結","more":"更多","delete_replies":{"confirm":"您是否也要刪除所有此貼文底下的回應？","direct_replies":{"other":"是，包含{{count}}條的直接回覆"},"all_replies":{"other":"是，包含所有{{count}}條回覆"},"just_the_post":"否，僅刪除此貼文。"},"admin":"貼文管理動作","wiki":"做為共筆","unwiki":"取消共筆","convert_to_moderator":"增加工作人員顏色","revert_to_regular":"移除工作人員顏色","rebake":"重建 HTML","unhide":"取消隱藏","change_owner":"更改作者","grant_badge":"核可徽章","lock_post":"封鎖貼文","lock_post_description":"禁止發文者編輯此貼文","unlock_post":"解除封鎖貼文","unlock_post_description":"允許發文者編輯此貼文","delete_topic_disallowed_modal":"您沒有權限刪除此話題。若您認為它應被刪除，請向板主檢舉並附上原因。","delete_topic_disallowed":"您沒有刪除此話題的權限。","delete_topic":"刪除話題","add_post_notice":"加入工作人員通知","remove_post_notice":"移除工作人員通知"},"actions":{"flag":"檢舉","defer_flags":{"other":"忽略檢舉"},"undo":{"off_topic":"撤回檢舉","spam":"撤回檢舉","inappropriate":"撤回檢舉","bookmark":"移除書籤","like":"撤回讚"},"people":{"off_topic":"檢舉為離題內容","spam":"檢舉為垃圾內容","inappropriate":"檢舉為不當內容","notify_moderators":"已通知的版主","notify_user":"已送出一則訊息","bookmark":"收藏","like_capped":{"other":"和其他{{count}}人都說讚"}},"by_you":{"off_topic":"你已檢舉此貼文離題","spam":"你已檢舉此貼文為垃圾訊息內容","inappropriate":"你已檢舉此貼文內容不妥","notify_moderators":"你已通知版主此貼文","notify_user":"您已送出訊息給這位使用者","bookmark":"你已將此貼文加上書籤","like":"你已在此貼文按讚"}},"delete":{"confirm":{"other":"您是否確定要刪除{{count}}篇貼文？"}},"merge":{"confirm":{"other":"您是否確定要合併{{count}}篇貼文？"}},"revisions":{"controls":{"first":"第一版","previous":"上一版","next":"下一版","last":"最新版","hide":"隱藏修訂紀錄","show":"顯示修訂紀錄","revert":"還原至該版本","edit_wiki":"編輯共筆","edit_post":"編輯貼文","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e{{icon}}\u003cstrong\u003e{{current}}\u003c/strong\u003e/{{total}}"},"displays":{"inline":{"title":"以單一網頁模式檢視，並標示增加與刪減的內容","button":"HTML"},"side_by_side":{"title":"以並排網頁模式檢視，分開標示增加與刪減的內容","button":"HTML"},"side_by_side_markdown":{"title":"顯示原始碼左右比對","button":"原始"}}},"raw_email":{"displays":{"raw":{"title":"顯示原始電子郵件","button":"原始"},"text_part":{"title":"顯示電子郵件部分文字","button":"文字"},"html_part":{"title":"顯示電子郵件HTML格式","button":"HTML"}}},"bookmarks":{"created":"已建立","name":"名稱"}},"category":{"can":"可以\u0026hellip; ","none":"( 無分類 )","all":"所有分類","choose":"選擇一個分類\u0026hellip;","edit":"編輯","edit_dialog_title":"編輯：%{categoryName}","view":"檢視分類裡的話題","general":"一般","settings":"設定","topic_template":"話題範本","tags":"標籤","tags_allowed_tags":"將這些標籤（Tags）限制為此分類做使用：","tags_allowed_tag_groups":"將這些標籤群組限制在此類別使用：","tags_placeholder":"（可選）允許使用的標籤列表","tag_groups_placeholder":"（可選）允許使用的標籤組列表","manage_tag_groups_link":"在此處管理標籤群組。","allow_global_tags_label":"也允許其他標籤（Tags）","topic_featured_link_allowed":"允許在該分類中發布精選的連結標題","delete":"刪除分類","create":"新分類","create_long":"建立新的分類","save":"儲存分類","slug":"分類目錄","slug_placeholder":"(選填) 在 url 加上虛線","creation_error":"建立分類時發生錯誤。","save_error":"儲存分類時發生錯誤。","name":"分類名稱","description":"描述","topic":"分類話題","logo":"分類圖示","background_image":"分類背景圖片","badge_colors":"識別顏色","background_color":"背景色","foreground_color":"前景色","name_placeholder":"請簡單明瞭。","color_placeholder":"任何網頁顏色","delete_confirm":"你確定要刪除此分類嗎?","delete_error":"刪除此分類時發生錯誤。","list":"列出分類","no_description":"請為此分類新增描述。","change_in_category_topic":"編輯描述","already_used":"此顏色已經用於其它分類","security":"安全性","special_warning":"警告：這個分類是已經自動建立好的分類，它的安全設置不能被更改。如果你不想要使用這個分類，直接刪除它，而不是另作他用。","uncategorized_security_warning":"此為特殊分類，僅作為沒有分類的話題暫存區，無法有安全設定。","uncategorized_general_warning":"此為特殊分類，作為尚未選定分類的新話題的預設分類。若您要停用此行為並強制使用者選擇分類，請在\u003ca href=\"%{settingLink}\"\u003e停用此設定，若您要更改名稱或說明，請到\u003ca href=\"%{customizeLink}\"\u003e自訂 / 文字內容\u003c/a\u003e。","images":"圖片","email_in":"自訂外來電郵地址:","email_in_allow_strangers":"接受非使用者的電郵","email_in_disabled":"\"用電子郵件張貼新的話題\"功能已被關閉。若要使用此功能，","email_in_disabled_click":"請啟用\"email in\"功能","mailinglist_mirror":"以類別來區分郵件列表","show_subcategory_list":"在此分類中，將子分類顯示在話題上方。","num_featured_topics":"分類頁面中顯示的話題數量：","subcategory_num_featured_topics":"類別頁上的精選話題數量：","all_topics_wiki":"新的話題預設為共筆。","subcategory_list_style":"子分類列表風格：","sort_order":"話題列表排序條件：","default_view":"預設話題列表：","default_top_period":"預設熱門時段","allow_badges_label":"允許授予本分類的徽章","edit_permissions":"編輯權限","reviewable_by_group":"除了管理員以外，此類別的話題、投訴也可以通過以下方式審查：","review_group_name":"群組名稱","require_topic_approval":"所有新話題皆需要通過管理員審核","require_reply_approval":"所有新回覆皆需要通過管理員審核","this_year":"今年","position":"在分類頁面上的位置：","default_position":"預設的位置","position_disabled":"分類的顯示將會以活躍度為排序依據。若要控制分類排序方法，","position_disabled_click":"請啟用\"固定分類位置\"設定","minimum_required_tags":"話題標籤的最低要求數量：","parent":"父分類","num_auto_bump_daily":"每日自動上浮的主題數：","navigate_to_first_post_after_read":"所有話題已讀後，跳轉至最新貼文","notifications":{"watching":{"title":"關注","description":"你將自動關注這些分類中的所有話題。每一個話題的每一個新帖，將通知你，還將顯示新回覆的數量。"},"watching_first_post":{"title":"關注新的發文","description":"您會收到此分類中的新話題通知，話題回應則不會。"},"tracking":{"title":"追蹤","description":"你將自動追蹤這些分類中的所有話題。如果有人@你或回覆你，將通知你，還將顯示新回覆的數量。"},"regular":{"title":"一般","description":"如果有人@你或回覆你，將通知你。"},"muted":{"title":"靜音","description":"在這些分類裡面，你將不會收到新話題任何通知，它們也不會出現在“最新”話題列表。 "}},"search_priority":{"label":"優先搜尋","options":{"normal":"一般","ignore":"忽略","very_low":"非常低","low":"低","high":"高","very_high":"非常高"}},"sort_options":{"default":"預設","likes":"讚","op_likes":"原始貼文讚","views":"瀏覽","posts":"貼文","activity":"活動","posters":"發表人","category":"分類","created":"創建","votes":"投票"},"sort_ascending":"升序","sort_descending":"降序","subcategory_list_styles":{"rows":"排","rows_with_featured_topics":"一排精選主題","boxes":"匣","boxes_with_featured_topics":"精選話題匣"},"settings_sections":{"general":"一般","moderation":"管理","appearance":"外觀","email":"電子信箱"}},"flagging":{"title":"感謝幫助社群遠離邪惡！","action":"檢舉貼文","take_action":"執行動作","notify_action":"訊息","official_warning":"正式警告","delete_spammer":"刪除垃圾貼文發送者","yes_delete_spammer":"是的，刪除垃圾貼文發送者","ip_address_missing":"(N/A)","hidden_email_address":"( 隱藏) ","submit_tooltip":"送出私人檢舉","take_action_tooltip":"使其立刻達到檢舉門檻，不用等待更多人檢舉","cant":"抱歉，你目前無法檢舉此貼文。","notify_staff":"私下通知管理人員","formatted_name":{"off_topic":"離題內容","inappropriate":"不當內容","spam":"垃圾內容"},"custom_placeholder_notify_user":"請具體說明出有建設性且溫和的意見。","custom_placeholder_notify_moderators":"讓我們知道您的意見，並請盡可能地提供相關連結和例子。","custom_message":{"at_least":{"other":"輸入至少 {{count}} 個字元"},"more":{"other":"還差 {{count}} 個..."},"left":{"other":"剩餘 {{count}}"}}},"flagging_topic":{"title":"感謝幫助社群遠離邪惡！","action":"檢舉話題","notify_action":"訊息"},"topic_map":{"title":"話題摘要","participants_title":"頻繁發文者","links_title":"熱門連結","links_shown":"顯示更多連結...","clicks":{"other":"%{count} 點擊"}},"post_links":{"about":"為本帖展開更多連結","title":{"other":"%{count} 更多"}},"topic_statuses":{"warning":{"help":"這是正式警告。"},"bookmarked":{"help":"已將此話題加入書籤"},"locked":{"help":"此話題已關閉，不再接受回覆"},"archived":{"help":"此話題已封存，已被凍結無法再修改"},"locked_and_archived":{"help":"這個話題被關閉並存檔；不再允許新的回覆，並不能改變"},"unpinned":{"title":"取消釘選","help":"此話題已取消置頂，將會以預設順序顯示。"},"pinned_globally":{"title":"全區置頂","help":"本話題已全局置頂；它始終會在最新列表以及它所屬的分類中置頂"},"pinned":{"title":"已釘選","help":"此話題已置頂，將顯示在它所屬分類話題列表的最上方"},"unlisted":{"help":"此話題已被隱藏，不會顯示於話題列表，只能由直接連結存取。"}},"posts":"貼文","posts_long":"此話題有 {{number}} 篇貼文","original_post":"原始貼文","views":"觀看","views_lowercase":{"other":"觀看"},"replies":"回覆","views_long":{"other":"這個話題已經被檢視過 {{number}} 次"},"activity":"活動","likes":"讚","likes_lowercase":{"other":"個讚"},"likes_long":"此話題收到了 {{number}} 個讚","users":"使用者","users_lowercase":{"other":"使用者"},"category_title":"分類","history":"歷史","changed_by":"作者 {{author}}","raw_email":{"title":"寄來的郵件","not_available":"不可使用"},"categories_list":"分類清單","filters":{"with_topics":"%{filter} 話題","with_category":"%{filter} %{category} 話題","latest":{"title":"最新","title_with_count":{"other":"最新 ({{count}})"},"help":"最近的話題"},"read":{"title":"已讀","help":"你看過的話題，以閱讀的先後順序排列"},"categories":{"title":"分類","title_in":"分類 - {{categoryName}}","help":"所有話題以分類區分"},"unread":{"title":"未讀","title_with_count":{"other":"未讀 ({{count}})"},"help":"你所關注或追蹤的話題有未讀貼文","lower_title_with_count":{"other":"{{count}} 個未讀"}},"new":{"lower_title_with_count":{"other":"{{count}} 近期"},"lower_title":"新話題","title":"新的","title_with_count":{"other":"近期 ({{count}})"},"help":"最近幾天開啟的話題"},"posted":{"title":"我的貼文","help":"你回覆過的話題"},"bookmarks":{"title":"書籤","help":"你加進書籤的話題"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} 分類最近的話題"},"top":{"title":"精選","help":"在本年、月、週或日最熱門的話題","all":{"title":"所有時間"},"yearly":{"title":"年"},"quarterly":{"title":"季度"},"monthly":{"title":"月"},"weekly":{"title":"周"},"daily":{"title":"日"},"all_time":"所以時間","this_year":"年","this_quarter":"季度","this_month":"月","this_week":"週","today":"今天","other_periods":"前往頂端"},"votes":{"title":"投票","help":"最多票數的主題"}},"browser_update":"抱歉，\u003ca href=\"https://www.discourse.org/faq/#browser\"\u003e您的瀏覽器版本過舊，無法讀取該網站\u003c/a\u003e。請\u003ca href=\"https://browsehappy.com\"\u003e更新您的瀏覽器\u003c/a\u003e。","permission_types":{"full":"建立 / 回覆 / 觀看","create_post":"回覆 / 觀看","readonly":"觀看"},"lightbox":{"download":"下載","previous":"上一個（左箭頭鍵）","next":"下一個（右箭頭鍵）","counter":"%curr%的%total%","close":"關閉（Esc）","content_load_error":"無法加載\u003ca href=\"%url%\"\u003e內容\u003c/a\u003e。","image_load_error":"無法加載\u003ca href=\"%url%\"\u003e圖片\u003c/a\u003e。"},"keyboard_shortcuts_help":{"title":"快捷鍵","jump_to":{"title":"轉至","home":"%{shortcut} 首頁","latest":"%{shortcut} 最新","new":"%{shortcut} 近期","unread":"%{shortcut} 未讀","categories":"%{shortcut} 分類","top":"%{shortcut} 熱門","bookmarks":"%{shortcut} 書籤","profile":"%{shortcut} 個人頁面","messages":"%{shortcut} 私信","drafts":"%{shortcut}草稿"},"navigation":{"title":"導航","jump":"%{shortcut} 前往貼文 #","back":"%{shortcut} 返回","up_down":"%{shortcut} 移動選擇焦點 \u0026uarr; \u0026darr;","open":"%{shortcut} 打開選擇的話題","next_prev":"%{shortcut} 下一個/前一個段落"},"application":{"title":"應用","create":"%{shortcut} 開啟新話題","notifications":"%{shortcut} Open notifications","hamburger_menu":"%{shortcut} 打開漢堡菜單","user_profile_menu":"%{shortcut} 打開使用者菜單","show_incoming_updated_topics":"%{shortcut} 顯示更新話題","search":"%{shortcut} 搜尋","help":"%{shortcut} 打開按鍵說明","dismiss_new_posts":"%{shortcut} 解除新/貼文提示","dismiss_topics":"%{shortcut} 解除話題提示","log_out":"%{shortcut} 退出"},"composing":{"title":"撰寫中","return":"%{shortcut} 回到編輯頁面","fullscreen":"%{shortcut} 進入全螢幕編輯器"},"actions":{"title":"動作","bookmark_topic":"%{shortcut} 切換話題收藏狀態","pin_unpin_topic":"%{shortcut} 置頂/截至置頂話題","share_topic":"%{shortcut} 分享話題","share_post":"%{shortcut} 分享貼文","reply_as_new_topic":"%{shortcut} 回覆為聯結話題","reply_topic":"%{shortcut} 回覆話題","reply_post":"%{shortcut} 回覆貼文","quote_post":"%{shortcut} 引用貼文","like":"%{shortcut} 讚貼文","flag":"%{shortcut} 標記貼文","bookmark":"%{shortcut} 收藏貼文","edit":"%{shortcut} 編輯貼文","delete":"%{shortcut} 刪除貼文","mark_muted":"%{shortcut} 忽略話題","mark_regular":"%{shortcut} 常規 (預設) 話題","mark_tracking":"%{shortcut} 追蹤話題","mark_watching":"%{shortcut} 看話題","print":"%{shortcut} 列印討論話題"}},"badges":{"earned_n_times":{"other":"授予徽章 %{count} 次"},"granted_on":"授予於%{date}","others_count":"其他有該徽章的人（%{count}）","title":"徽章","allow_title":"您能使用此徽章作為稱號","multiple_grant":"您能多次獲得此徽章","badge_count":{"other":"%{count} 徽章"},"more_badges":{"other":"+%{count} 更多"},"granted":{"other":"%{count} 授予"},"select_badge_for_title":"選擇一個徽章作為你的頭銜使用","none":"(無)","successfully_granted":"已成功將%{badge}徽章給予%{username}","badge_grouping":{"getting_started":{"name":"開始"},"community":{"name":"社區"},"trust_level":{"name":"信任等級"},"other":{"name":"其它"},"posting":{"name":"發文"}}},"tagging":{"all_tags":"所有標籤","other_tags":"其他標籤","selector_all_tags":"所有標籤","selector_no_tags":"無標籤","changed":"標籤被修改：","tags":"標籤","choose_for_topic":"可選標籤","add_synonyms":"新增","delete_tag":"刪除標籤","delete_confirm":{"other":"您確定要刪除此標籤並將它從{{count}}個話題中移除嗎？"},"delete_confirm_no_topics":"您是否確定要刪除這個標籤？","rename_tag":"重命名標籤","rename_instructions":"標籤的新名稱：","sort_by":"排序方式：","sort_by_count":"總數","sort_by_name":"名稱","manage_groups":"管理標籤組","manage_groups_description":"管理標籤的群組","upload":"上傳標籤","upload_description":"批次上傳 csv 檔案以建立標籤","upload_instructions":"一行一個，可選擇以 'tag_name,tag_group' 的格式包含一個標籤群組。","upload_successful":"標籤已成功上傳","delete_unused_confirmation":{"other":"%{count}個標籤將被刪除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}以及其他%{count}個"},"delete_unused":"刪除未被使用的標籤","delete_unused_description":"刪除所有未被附加在任何話題或個人訊息的標籤","cancel_delete_unused":"取消","filters":{"without_category":"%{tag}的%{filter}話題","with_category":"%{filter} %{tag}話題在%{category}","untagged_without_category":"無標籤的%{filter}話題","untagged_with_category":"%{category}無標籤的%{filter}話題"},"notifications":{"watching":{"title":"關注","description":"你將自動監看該標籤中的所有話題。新貼文和新話題會通知你，再者未讀和新帖的數量也將顯示在話題旁邊。"},"watching_first_post":{"title":"關注新的發文","description":"您會收到此標籤中新話題的通知，話題底下的回應則不會有通知。"},"tracking":{"title":"跟蹤","description":"您將會自動追蹤任何含有這些標籤的話題。新貼文數量將顯示在每個話題後。"},"regular":{"title":"普通","description":"如果有人@你或回覆你的貼文，將通知你。"},"muted":{"title":"靜音","description":"你將不會收到這些分類中的新討論話題通知，它們也不會出現在你的未讀欄內。"}},"groups":{"title":"標籤組","about":"將標籤分組以便管理。","new":"新標籤組","tags_label":"標籤組內標籤：","parent_tag_label":"上級標籤：","parent_tag_placeholder":"可選","parent_tag_description":"未設置上級標籤前群組內標籤無法使用。","one_per_topic_label":"只可給話題設置一個該組內的標籤","new_name":"新標籤組名","save":"保存","delete":"刪除","confirm_delete":"確定要刪除此標籤組嗎？","everyone_can_use":"所有使用者都能使用標籤。","usable_only_by_staff":"所有使用者都能看到標籤，但只有管理員能使用。","visible_only_to_staff":"只有管理員能看到標籤。"},"topics":{"none":{"unread":"你沒有未讀話題。","new":"你沒有新的話題。","read":"你尚未閲讀任何話題。","posted":"你尚未在任何話題中發文。","latest":"沒有最新話題。","bookmarks":"你還沒有收藏話題。","top":"沒有最佳話題。"},"bottom":{"latest":"沒有更多的最新話題。","posted":"沒有更多的發佈話題。","read":"沒有更多已閲話題可看了。","new":"已經沒有其他新話題了。","unread":"沒有更多未讀話題了。","top":"沒有更多最佳話題了。","bookmarks":"沒有更多收藏的話題了。"}}},"invite":{"custom_message":"撰寫\u003ca href\u003e自訂訊息\u003c/a\u003e，來個人化您的邀請","custom_message_placeholder":"輸入留言","custom_message_template_forum":"你好，你應該來我們這個論壇！","custom_message_template_topic":"你好，我覺得你可能會喜歡這個話題！"},"forced_anonymous":"由於系統資源超過負荷，暫時向所有使用者顯示，包含已登出的使用者。","safe_mode":{"enabled":"安全模式已經開啟，關閉該瀏覽器窗口以退出安全模式"},"poll":{"voters":{"other":"投票者"},"total_votes":{"other":"總票數"},"average_rating":"平均評分：\u003cstrong\u003e%{average}\u003c/strong\u003e。","multiple":{"help":{"at_least_min_options":{"other":"至少選擇 \u003cstrong\u003e%{count}\u003c/strong\u003e 個選項"},"up_to_max_options":{"other":"最多選擇 \u003cstrong\u003e%{count}\u003c/strong\u003e 個選項"},"x_options":{"other":"選擇 \u003cstrong\u003e%{count}\u003c/strong\u003e 個選項"},"between_min_and_max_options":"選擇 \u003cstrong\u003e%{min}\u003c/strong\u003e 至 \u003cstrong\u003e%{max}\u003c/strong\u003e 個選項"}},"cast-votes":{"title":"投你的票","label":"現在投票！"},"show-results":{"title":"顯示投票結果","label":"顯示結果"},"hide-results":{"title":"返回到你的投票"},"export-results":{"label":"匯出"},"open":{"title":"開啟投票","label":"開啟","confirm":"你確定要開啟這個投票嗎？"},"close":{"title":"關閉投票","label":"關閉","confirm":"你確定要關閉這個投票？"},"error_while_toggling_status":"對不起，改變投票狀態時出錯了。","error_while_casting_votes":"對不起，投票時出錯了。","error_while_fetching_voters":"對不起，顯示投票者時出錯了。","ui_builder":{"title":"創建投票","insert":"插入投票","help":{"invalid_values":"最小值必須比最大值小。","min_step_value":"最小梯級階值為 1"},"poll_type":{"label":"類型","regular":"單選","multiple":"多選","number":"評分"},"poll_result":{"label":"結果"},"poll_config":{"max":"最大","min":"最小","step":"梯級"},"poll_public":{"label":"顯示投票人"},"poll_options":{"label":"每行輸入一個調查選項"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"為所有的新使用者啟動使用者教學。","welcome_message":"寄送包含快速入門指引的歡迎訊息給所有新使用者。"}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}"},"create":{"form":{"insert":"插入","advanced_mode":"進階模式","simple_mode":"簡單模式","timezones_title":"時區顯示","date_title":"日期","time_title":"時間"}}},"presence":{"replying":"正在回覆","editing":"正在編輯"},"voting":{"reached_limit":"您已退出投票，移除現有的投票！","list_votes":"列出您的投票","votes_nav_help":"最多票數的主題","voted":"您已在此主題投票過了","allow_topic_voting":"讓使用者可以在這個分類中的主題裡投票","vote_title":"投票","vote_title_plural":"投票","voted_title":"已投票","voting_closed_title":"已關閉","voting_limit":"限制"},"docker":{"upgrade":"您的 Discourse 版本已過期。","perform_upgrade":"點此進行升級。"}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","themes":{"broken_theme_alert":"因为主题或组件%{theme}有错误，你的网站可能无法正常运行。 在%{path}禁用它。"},"s3":{"regions":{"us_gov_west_1":"AWS 政府云（US-West）"}},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"settings":{"priorities":{"title":"需审核优先级"}},"user":{"bio":"简介","website":"网站"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"all_categories":"（所有分类）","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）"}},"statuses":{"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_queued_topic":{"title":"队列中到主题"}}},"directory":{"last_updated":"最近更新："},"groups":{"confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","members":{"forbidden":"你不可以查看成员列表。"},"alias_levels":{"owners_mods_and_admins":"仅群组成员、版主与管理员"}},"user":{"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","timezone":"时区","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。"},"second_factor":{"enable":"管理两步验证","forgot_password":"忘记密码？","use":"使用身份验证器应用","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"associated_accounts":{"confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"invited":{"sent":"上次发送"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"email_login":{"logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_backup":"使用备用码登录","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","discord":{"name":"Discord","title":"with Discord"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"shortcut_modifier_key":{"enter":"回车"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"composer":{"reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}},"details_text":"此本文本将被隐藏"},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","membership_request_consolidated":"新的成员申请"}},"search":{"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"topic":{"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"progress":{"jump_prompt_long":"跳到……"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","remove_timer":"移除计时器"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。"},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称"}},"poll":{"public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_title":"循环","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","recurring_none":"没有循环","invalid_date":"日期无效，请确保日期和时间正确","format_title":"日期格式","timezone":"时区","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"details":{"title":"隐藏详情"},"presence":{"replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"},"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m"},"about_x_hours":{"one":"%{count}h"},"x_days":{"one":"%{count}d"},"x_months":{"one":"%{count}mon"},"about_x_years":{"one":"%{count}y"},"over_x_years":{"one":"\u003e %{count}y"},"almost_x_years":{"one":"%{count}y"}},"medium":{"x_minutes":{"one":"%{count} min"},"x_hours":{"one":"%{count} hour"},"x_days":{"one":"%{count} day"}},"medium_with_ago":{"x_minutes":{"one":"%{count} min ago"},"x_hours":{"one":"%{count} hour ago"},"x_days":{"one":"%{count} day ago"},"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}},"later":{"x_days":{"one":"%{count} day later"},"x_months":{"one":"%{count} month later"},"x_years":{"one":"%{count} year later"}}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"%{count} user"}},"groups":{"title":{"one":"Group"}},"categories":{"topic_sentence":{"one":"%{count} topic"},"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"given"},"likes_received":{"one":"received"},"days_visited":{"one":"day visited"},"topics_entered":{"one":"topic viewed"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"local_time":"Local Time","replies_lowercase":{"one":"reply"},"email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?"}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts"},"group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e topic."}}},"topic":{"filter_to":{"one":"%{count} post in topic"},"new_topics":{"one":"%{count} new topic"},"unread_topics":{"one":"%{count} unread topic"},"total_unread_posts":{"one":"you have %{count} unread post in this topic"},"unread_posts":{"one":"you have %{count} unread old post in this topic"},"new_posts":{"one":"there is %{count} new post in this topic since you last read it"},"likes":{"one":"there is %{count} like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"}},"filters":{"n_posts":{"one":"%{count} post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e post."}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view %{count} hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes_title":{"one":"%{count} person liked this post"},"has_likes_title_you":{"one":"you and %{count} other person liked this post"},"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?"}}},"flagging":{"custom_message":{"at_least":{"one":"enter at least %{count} character"},"more":{"one":"%{count} to go..."},"left":{"one":"%{count} remaining"}}},"topic_map":{"clicks":{"one":"%{count} click"}},"post_links":{"title":{"one":"%{count} more"}},"views_lowercase":{"one":"view"},"views_long":{"one":"this topic has been viewed %{count} time"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (%{count})"}},"unread":{"title_with_count":{"one":"Unread (%{count})"},"lower_title_with_count":{"one":"%{count} unread"}},"new":{"lower_title_with_count":{"one":"%{count} new"},"title_with_count":{"one":"New (%{count})"}},"category":{"title_with_count":{"one":"{{categoryName}} (%{count})"}}},"badges":{"earned_n_times":{"one":"Earned this badge %{count} time"},"badge_count":{"one":"%{count} Badge"},"more_badges":{"one":"+%{count} More"},"granted":{"one":"%{count} granted"}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option"}}},"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'zh_TW';
I18n.pluralizationRules.zh_TW = MessageFormat.locale.zh_TW;
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


    var zhTw = moment.defineLocale('zh-tw', {
        months : '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
        monthsShort : '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
        weekdays : '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
        weekdaysShort : '週日_週一_週二_週三_週四_週五_週六'.split('_'),
        weekdaysMin : '日_一_二_三_四_五_六'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'YYYY/MM/DD',
            LL : 'YYYY年M月D日',
            LLL : 'YYYY年M月D日 HH:mm',
            LLLL : 'YYYY年M月D日dddd HH:mm',
            l : 'YYYY/M/D',
            ll : 'YYYY年M月D日',
            lll : 'YYYY年M月D日 HH:mm',
            llll : 'YYYY年M月D日dddd HH:mm'
        },
        meridiemParse: /凌晨|早上|上午|中午|下午|晚上/,
        meridiemHour : function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === '凌晨' || meridiem === '早上' || meridiem === '上午') {
                return hour;
            } else if (meridiem === '中午') {
                return hour >= 11 ? hour : hour + 12;
            } else if (meridiem === '下午' || meridiem === '晚上') {
                return hour + 12;
            }
        },
        meridiem : function (hour, minute, isLower) {
            var hm = hour * 100 + minute;
            if (hm < 600) {
                return '凌晨';
            } else if (hm < 900) {
                return '早上';
            } else if (hm < 1130) {
                return '上午';
            } else if (hm < 1230) {
                return '中午';
            } else if (hm < 1800) {
                return '下午';
            } else {
                return '晚上';
            }
        },
        calendar : {
            sameDay : '[今天] LT',
            nextDay : '[明天] LT',
            nextWeek : '[下]dddd LT',
            lastDay : '[昨天] LT',
            lastWeek : '[上]dddd LT',
            sameElse : 'L'
        },
        dayOfMonthOrdinalParse: /\d{1,2}(日|月|週)/,
        ordinal : function (number, period) {
            switch (period) {
                case 'd' :
                case 'D' :
                case 'DDD' :
                    return number + '日';
                case 'M' :
                    return number + '月';
                case 'w' :
                case 'W' :
                    return number + '週';
                default :
                    return number;
            }
        },
        relativeTime : {
            future : '%s內',
            past : '%s前',
            s : '幾秒',
            ss : '%d 秒',
            m : '1 分鐘',
            mm : '%d 分鐘',
            h : '1 小時',
            hh : '%d 小時',
            d : '1 天',
            dd : '%d 天',
            M : '1 個月',
            MM : '%d 個月',
            y : '1 年',
            yy : '%d 年'
        }
    });

    return zhTw;

})));

// moment-timezone-localization for lang code: zh_Hant

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"阿比讓","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"阿克拉","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"阿迪斯阿貝巴","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"阿爾及爾","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"阿斯瑪拉","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"巴馬科","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"班吉","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"班竹","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"比紹","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"布蘭太爾","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"布拉柴維爾","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"布松布拉","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"開羅","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"卡薩布蘭卡","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"休達","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"柯那克里","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"達喀爾","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"沙蘭港","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"吉布地","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"杜阿拉","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"阿尤恩","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"自由城","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"嘉柏隆里","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"哈拉雷","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"約翰尼斯堡","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"朱巴","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"坎帕拉","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"喀土穆","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"基加利","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"金夏沙","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"拉哥斯","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"自由市","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"洛美","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"羅安達","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"盧本巴希","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"路沙卡","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"馬拉博","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"馬普托","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"馬賽魯","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"墨巴本","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"摩加迪休","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"蒙羅維亞","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"奈洛比","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"恩賈梅納","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"尼亞美","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"諾克少","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"瓦加杜古","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"波多諾佛","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"聖多美","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"的黎波里","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"突尼斯","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"溫得和克","id":"Africa/Windhoek"},{"value":"America/Adak","name":"艾達克","id":"America/Adak"},{"value":"America/Anchorage","name":"安克拉治","id":"America/Anchorage"},{"value":"America/Anguilla","name":"安奎拉","id":"America/Anguilla"},{"value":"America/Antigua","name":"安地卡","id":"America/Antigua"},{"value":"America/Araguaina","name":"阿拉圭那","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"拉略哈","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"里奧加耶戈斯","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"薩爾塔","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"聖胡安","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"聖路易","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"吐庫曼","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"烏斯懷亞","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"荷屬阿魯巴","id":"America/Aruba"},{"value":"America/Asuncion","name":"亞松森","id":"America/Asuncion"},{"value":"America/Bahia","name":"巴伊阿","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"巴伊亞班德拉斯","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"巴貝多","id":"America/Barbados"},{"value":"America/Belem","name":"貝倫","id":"America/Belem"},{"value":"America/Belize","name":"貝里斯","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"白朗薩布隆","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"保維斯塔","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"波哥大","id":"America/Bogota"},{"value":"America/Boise","name":"波夕","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"布宜諾斯艾利斯","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"劍橋灣","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"格蘭場","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"坎昆","id":"America/Cancun"},{"value":"America/Caracas","name":"卡拉卡斯","id":"America/Caracas"},{"value":"America/Catamarca","name":"卡塔馬卡","id":"America/Catamarca"},{"value":"America/Cayenne","name":"開雲","id":"America/Cayenne"},{"value":"America/Cayman","name":"開曼群島","id":"America/Cayman"},{"value":"America/Chicago","name":"芝加哥","id":"America/Chicago"},{"value":"America/Chihuahua","name":"奇華華","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"阿蒂科肯","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"哥多華","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"哥斯大黎加","id":"America/Costa_Rica"},{"value":"America/Creston","name":"克雷斯頓","id":"America/Creston"},{"value":"America/Cuiaba","name":"古雅巴","id":"America/Cuiaba"},{"value":"America/Curacao","name":"庫拉索","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"丹馬沙文","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"道森","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"道森克里克","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"丹佛","id":"America/Denver"},{"value":"America/Detroit","name":"底特律","id":"America/Detroit"},{"value":"America/Dominica","name":"多米尼克","id":"America/Dominica"},{"value":"America/Edmonton","name":"艾德蒙吞","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"艾魯內佩","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"薩爾瓦多","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"納爾遜堡","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"福塔力莎","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"格雷斯貝","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"努克","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"鵝灣","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"大特克島","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"格瑞納達","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"瓜地洛普","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"瓜地馬拉","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"瓜亞基爾","id":"America/Guayaquil"},{"value":"America/Guyana","name":"蓋亞那","id":"America/Guyana"},{"value":"America/Halifax","name":"哈里法克斯","id":"America/Halifax"},{"value":"America/Havana","name":"哈瓦那","id":"America/Havana"},{"value":"America/Hermosillo","name":"埃莫西約","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"印第安那州諾克斯","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"印第安那州馬倫哥","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"印第安那州彼得堡","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"印第安那州泰爾城","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"印第安那州維威","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"印第安那州溫森斯","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"印第安那州威納馬克","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"印第安那波里斯","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"伊奴維克","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"伊魁特","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"牙買加","id":"America/Jamaica"},{"value":"America/Jujuy","name":"胡胡伊","id":"America/Jujuy"},{"value":"America/Juneau","name":"朱諾","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"肯塔基州蒙地卻羅","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"克拉倫代克","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"拉巴斯","id":"America/La_Paz"},{"value":"America/Lima","name":"利馬","id":"America/Lima"},{"value":"America/Los_Angeles","name":"洛杉磯","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"路易斯維爾","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"下太子區","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"馬瑟歐","id":"America/Maceio"},{"value":"America/Managua","name":"馬拿瓜","id":"America/Managua"},{"value":"America/Manaus","name":"瑪瑙斯","id":"America/Manaus"},{"value":"America/Marigot","name":"馬里戈特","id":"America/Marigot"},{"value":"America/Martinique","name":"馬丁尼克","id":"America/Martinique"},{"value":"America/Matamoros","name":"馬塔莫羅斯","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"馬薩特蘭","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"門多薩","id":"America/Mendoza"},{"value":"America/Menominee","name":"美諾米尼","id":"America/Menominee"},{"value":"America/Merida","name":"梅里達","id":"America/Merida"},{"value":"America/Metlakatla","name":"梅特拉卡特拉","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"墨西哥市","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"密啟崙","id":"America/Miquelon"},{"value":"America/Moncton","name":"蒙克頓","id":"America/Moncton"},{"value":"America/Monterrey","name":"蒙特瑞","id":"America/Monterrey"},{"value":"America/Montevideo","name":"蒙特維多","id":"America/Montevideo"},{"value":"America/Montserrat","name":"蒙哲臘","id":"America/Montserrat"},{"value":"America/Nassau","name":"拿索","id":"America/Nassau"},{"value":"America/New_York","name":"紐約","id":"America/New_York"},{"value":"America/Nipigon","name":"尼皮岡","id":"America/Nipigon"},{"value":"America/Nome","name":"諾姆","id":"America/Nome"},{"value":"America/Noronha","name":"諾倫哈","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"北達科他州布由拉","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"北達科他州中心","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"北達科他州紐沙倫","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"奧希納加","id":"America/Ojinaga"},{"value":"America/Panama","name":"巴拿馬","id":"America/Panama"},{"value":"America/Pangnirtung","name":"潘尼爾東","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"巴拉馬利波","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"鳳凰城","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"太子港","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"西班牙港","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"維留港","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"波多黎各","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"蓬塔阿雷納斯","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"雨河鎮","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"蘭今灣","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"雷西非","id":"America/Recife"},{"value":"America/Regina","name":"里賈納","id":"America/Regina"},{"value":"America/Resolute","name":"羅斯魯特","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"里約布蘭","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"聖伊薩貝爾","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"聖塔倫","id":"America/Santarem"},{"value":"America/Santiago","name":"聖地牙哥","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"聖多明哥","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"聖保羅","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"伊托科爾托米特","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"錫特卡","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"聖巴托洛繆島","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"聖約翰","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"聖基茨","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"聖露西亞","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"聖托馬斯","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"聖文森","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"斯威夫特卡倫特","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"德古斯加巴","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"杜里","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"珊德灣","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"提華納","id":"America/Tijuana"},{"value":"America/Toronto","name":"多倫多","id":"America/Toronto"},{"value":"America/Tortola","name":"托爾托拉","id":"America/Tortola"},{"value":"America/Vancouver","name":"溫哥華","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"懷特霍斯","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"溫尼伯","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"雅庫塔","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"耶洛奈夫","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"凱西","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"戴維斯","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"杜蒙杜比爾","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"麥覺理","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"莫森","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"麥克默多","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"帕麥","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"羅瑟拉","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"昭和基地","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"綽爾","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"沃斯托克","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"隆意耳拜恩","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"亞丁","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"阿拉木圖","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"安曼","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"阿那底","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"阿克套","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"阿克托比","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"阿什哈巴特","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"阿特勞","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"巴格達","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"巴林","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"巴庫","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"曼谷","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"巴爾瑙爾","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"貝魯特","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"比什凱克","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"汶萊","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"加爾各答","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"赤塔","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"喬巴山","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"可倫坡","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"大馬士革","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"達卡","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"帝力","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"杜拜","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"杜桑貝","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"法馬古斯塔","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"加薩","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"赫布隆","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"香港","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"科布多","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"伊爾庫次克","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"雅加達","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"加亞布拉","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"耶路撒冷","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"喀布爾","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"堪察加","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"喀拉蚩","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"加德滿都","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"堪地加","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"克拉斯諾亞爾斯克","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"吉隆坡","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"古晉","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"科威特","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"澳門","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"馬加丹","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"馬卡沙爾","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"馬尼拉","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"馬斯開特","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"尼古西亞","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"新庫茲涅茨克","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"新西伯利亞","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"鄂木斯克","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"烏拉爾","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"金邊","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"坤甸","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"平壤","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"卡達","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"克孜勒奧爾達","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"仰光","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"利雅德","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"胡志明市","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"庫頁島","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"撒馬爾罕","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"首爾","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"上海","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"新加坡","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"中科雷姆斯克","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"台北","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"塔什干","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"第比利斯","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"德黑蘭","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"廷布","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"東京","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"托木斯克","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"烏蘭巴托","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"烏魯木齊","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"烏斯內拉","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"永珍","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"海參崴","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"雅庫次克","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"葉卡捷林堡","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"葉里溫","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"亞速爾群島","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"百慕達","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"加納利","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"維德角","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"法羅群島","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"馬得拉群島","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"雷克雅維克","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"南喬治亞","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"聖赫勒拿島","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"史坦利","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"阿得雷德","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"布利斯班","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"布羅肯希爾","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"克黎","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"達爾文","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"尤克拉","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"荷巴特","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"林德曼","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"豪勳爵島","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"墨爾本","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"伯斯","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"雪梨","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"世界標準時間UTC","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"阿姆斯特丹","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"安道爾","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"阿斯特拉罕","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"雅典","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"貝爾格勒","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"柏林","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"布拉提斯拉瓦","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"布魯塞爾","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"布加勒斯特","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"布達佩斯","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"布辛根","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"基西紐","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"哥本哈根","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"愛爾蘭標準時間都柏林","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"直布羅陀","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"根息島","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"赫爾辛基","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"曼島","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"伊斯坦堡","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"澤西島","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"加里寧格勒","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"基輔","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"基洛夫","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"里斯本","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"盧比安納","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"英國夏令時間倫敦","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"盧森堡","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"馬德里","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"馬爾他","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"瑪麗港","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"明斯克","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"摩納哥","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"莫斯科","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"奧斯陸","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"巴黎","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"波多里察","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"布拉格","id":"Europe/Prague"},{"value":"Europe/Riga","name":"里加","id":"Europe/Riga"},{"value":"Europe/Rome","name":"羅馬","id":"Europe/Rome"},{"value":"Europe/Samara","name":"沙馬拉","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"聖馬利諾","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"塞拉耶佛","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"薩拉托夫","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"辛非洛浦","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"史高比耶","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"索菲亞","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"斯德哥爾摩","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"塔林","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"地拉那","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"烏里揚諾夫斯克","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"烏茲哥洛","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"瓦都茲","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"梵蒂岡","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"維也納","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"維爾紐斯","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"伏爾加格勒","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"華沙","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"札格瑞布","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"札波羅結","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"蘇黎世","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"安塔那那利弗","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"查戈斯","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"聖誕島","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"科科斯群島","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"科摩羅群島","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"凱爾蓋朗島","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"馬埃島","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"馬爾地夫","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"模里西斯","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"馬約特島","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"留尼旺島","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"阿皮亞","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"奧克蘭","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"布干維爾","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"查坦","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"復活島","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"埃法特","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"恩得伯理島","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"法考福","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"斐濟","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"富那富提","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"加拉巴哥群島","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"甘比爾群島","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"瓜達康納爾島","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"關島","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"檀香山","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"強斯頓","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"基里地馬地島","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"科斯瑞","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"瓜加林島","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"馬朱諾","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"馬可薩斯島","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"中途島","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"諾魯","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"紐埃島","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"諾福克","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"諾美亞","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"巴哥巴哥","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"帛琉","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"皮特肯群島","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"波納佩","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"莫士比港","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"拉羅湯加","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"塞班","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"大溪地","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"塔拉瓦","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"東加塔布島","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"楚克","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"威克","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"瓦利斯","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
