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
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.reached_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"{\" found. at undefined:1376:10";}, "logs_error_rate_notice.exceeded_hour_MF" : function(){ return "Invalid Format: Error: No 'other' form found in pluralFormatPattern 0";}, "logs_error_rate_notice.exceeded_minute_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected \"=\", \"}\" or [a-zA-Z$_] but \"{\" found. at undefined:1376:10";}, "topic.read_more_MF" : function(d){
var r = "";
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
r += "/unread'>1 okunmamış mesaj</a> ";
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
})() + " okunmamış mesaj</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ve";
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
r += "/new'>1 yeni</a> konu";
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
r += "ve ";
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
})() + " yeni</a> konu";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " var. ";
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
r += " kategorisine";
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
r += " göz atabilirsin.";
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "Bu kullanıcının ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> gönderisini";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> gönderisini";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ve ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> konusunu";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> konusunu";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " silmek üzeresin, ayrıca kullanıcının hesabı kaldırılacak, giriş yaptığı <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> IP adresinden giriş yapması engellenecek ve <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> e-posta adresi kalıcı yasaklı listesine eklenecek. Bu kullanıcının gerçekten bir spamcı olduğuna emin misin?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Bu konuda ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 cevap";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " cevap";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "ve yüksek beğeni/gönderi oranı";
return r;
},
"med" : function(d){
var r = "";
r += "ve çok yüksek beğeni/gönderi oranı";
return r;
},
"high" : function(d){
var r = "";
r += "ve aşırı yüksek beğeni/gönderi oranı";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += " var\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 gönderi";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " gönderi";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ve ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 konu";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " konu";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " silmek üzeresin. Emin misin?";
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["tr_TR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.tr_TR = function(n) {
  return 'other';
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

I18n.translations = {"tr_TR":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Bayt","other":"Bayt"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}b","millions":"{{number}}M"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","time_short_day":"ggg, SS:dd","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"MMMM Do","long_with_year":"D MMM, YYYY h:mm a","long_with_year_no_time":"D MMM, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"D MMM, 'YY LT","long_date_without_year":"D MMM, LT","long_date_with_year_without_time":"D MMM, 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} önce","tiny":{"half_a_minute":"\u003c 1d","less_than_x_seconds":{"one":"\u003c %{count}s","other":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}dk","other":"\u003c %{count}dk"},"x_minutes":{"one":"%{count}d","other":"%{count}d"},"about_x_hours":{"one":"%{count}s","other":"%{count}s"},"x_days":{"one":"%{count}g","other":"%{count}g"},"x_months":{"one":"%{count}ay","other":"%{count}ay"},"about_x_years":{"one":"%{count}y","other":"%{count}y"},"over_x_years":{"one":"\u003e %{count}y","other":"\u003e %{count}y"},"almost_x_years":{"one":"%{count}y","other":"%{count}y"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} dakika","other":"%{count} dakika"},"x_hours":{"one":"%{count} saat","other":"%{count} saat"},"x_days":{"one":"%{count} gün","other":"%{count} gün"},"date_year":"D MMM, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} dakika önce","other":"%{count} dakika önce"},"x_hours":{"one":"%{count} saat önce","other":"%{count} saat önce"},"x_days":{"one":"%{count} gün önce","other":"%{count} gün önce"},"x_months":{"one":"%{count} ay önce","other":"%{count} ay önce"},"x_years":{"one":"%{count} yıl önce","other":"%{count} yıl önce"}},"later":{"x_days":{"one":"%{count} gün sonra","other":"%{count} gün sonra"},"x_months":{"one":"%{count} ay sonra","other":"%{count} ay sonra"},"x_years":{"one":"%{count} yıl sonra","other":"%{count} yıl sonra"}},"previous_month":"Önceki Ay","next_month":"Sonraki Ay","placeholder":"tarih"},"share":{"topic_html":"Konu: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"#%{postNumber} numaralı gönderiyi paylaş","close":"kapat","twitter":"bu linki Twitter'da paylaş","facebook":"bu linki Facebook'ta paylaş","email":"bu linki epostayla yolla"},"action_codes":{"public_topic":"bu konuyu %{when} herkese açık yaptı","private_topic":"bu konuyu %{when} kişisel mesaj yaptı","split_topic":"bu konuyu %{when} ayırdı","invited_user":"%{when} %{who} davet edildi","invited_group":"%{who} %{when} davet edildi","user_left":"%{who} bu mesajdan ayrıldı %{when}","removed_user":"%{when} %{who} kaldırıldı","removed_group":"%{who} %{when} kaldırıldı","autobumped":"otomatik olarak çarptı %{when}","autoclosed":{"enabled":"%{when} kapatıldı","disabled":"%{when} açıldı"},"closed":{"enabled":"%{when} kapatıldı","disabled":"%{when} açıldı"},"archived":{"enabled":"%{when} arşivlendi","disabled":"%{when} arşivden çıkarıldı"},"pinned":{"enabled":"%{when} en yukarıda sabitlendi","disabled":"%{when} en yukarıda sabitlenmesi kaldırıldı"},"pinned_globally":{"enabled":"%{when} her yerde en yukarıda sabitlendi","disabled":"%{when} en yukarıda sabitlenmesi kaldırıldı"},"visible":{"enabled":"%{when} listelendi","disabled":"%{when} listelenmedi"},"banner":{"enabled":"Bunu pankart yaptı %{when}. Kullanıcı tarafından yoksayılana kadar her sayfanın en üstünde belirecek.","disabled":"Pankart kaldırıldı %{when}. Bundan sonra her sayfanın en üstünde gözükmeyecek. "}},"topic_admin_menu":"konu eylemleri","wizard_required":"Yeni Discourse'una hoşgeldin! Haydi kuruluma başlayalım! \u003ca href='%{url}' data-auto-route='true'\u003eKurulum Sihirbazı\u003c/a\u003e ✨","emails_are_disabled":"Giden tüm e-postalar yönetici tarafından devre dışı bırakıldı. Herhangi bir e-posta bildirimi gönderilmeyecek.","bootstrap_mode_enabled":"Yeni sitenizi daha kolay başlatmak için önyükleme modundasınız. Tüm yeni kullanıcılara güven düzeyi 1 verilir ve günlük e-posta özet güncellemeleri etkinleştirilir. Bu,%{min_users} kullanıcının katıldığı zaman otomatik olarak kapatılacaktır.","bootstrap_mode_disabled":"Önyükleme modu 24 saat içinde devre dışı bırakılacak. ","themes":{"default_description":"Varsayılan ","broken_theme_alert":"Tema bileşeninde hata olduğundan siteniz çalışmayabilir. (%{theme}) %{path} adresinden devre dışı bırakın."},"s3":{"regions":{"ap_northeast_1":"Asya Pasifik (Tokyo)","ap_northeast_2":"Asya Pasifik (Seul)","ap_south_1":"Asya Pasifik (Mumbai)","ap_southeast_1":"Asya Pasifik (Singapur)","ap_southeast_2":"Asya Pasifik (Sidney)","ca_central_1":"Kanada (Merkez)","cn_north_1":"Çin (Pekin)","cn_northwest_1":"Çin (Pekin)","eu_central_1":"AB (Frankfurt)","eu_north_1":"Avrupa (Stockholm)","eu_west_1":"AB (İrlanda)","eu_west_2":"AB (Londra)","eu_west_3":"AB (Paris)","sa_east_1":"Güney Amerika (São Paulo)","us_east_1":"Doğu ABD (Kuzey Virjinya)","us_east_2":"Doğu ABD (Ohio)","us_gov_east_1":"AWS GovCloud (ABD-Doğu)","us_gov_west_1":"AWS GovCloud (ABD-Batı)","us_west_1":"Batı ABD (Kuzey Kaliforniya)","us_west_2":"Batı ABD (Oregon)"}},"edit":"bu konunun başlığını ve kategorisini düzenle","expand":"Genişlet","not_implemented":"Bu özellik henüz geliştirilmedi, üzgünüz!","no_value":"Hayır","yes_value":"Evet","submit":"Gönder","generic_error":"Üzgünüz, bir hata oluştu.","generic_error_with_reason":"Bir hata oluştu: %{error}","go_ahead":"Devam edin","sign_up":"Kayıt Ol","log_in":"Giriş Yap","age":"Yaş","joined":"Katıldı","admin_title":"Yönetici","show_more":"daha fazla göster","show_help":"seçenekler","links":"Bağlantılar","links_lowercase":{"one":"bağlantılar","other":"bağlantılar"},"faq":"SSS","guidelines":"Öneriler","privacy_policy":"Gizlilik Sözleşmesi","privacy":"Gizlilik","tos":"Kullanım Koşulları","rules":"Kurallar","conduct":"Davranış kodu","mobile_view":"Mobil Görünüm","desktop_view":"Masaüstü Görünümü","you":"Sen","or":"ya da","now":"hemen şimdi","read_more":"devamını oku","more":"Daha fazla","less":"Daha az","never":"asla","every_30_minutes":"her 30 dakikada bir","every_hour":"her saat","daily":"günlük","weekly":"haftalık","every_month":"her ay","every_six_months":"her altı ayda bir","max_of_count":"maksimum {{count}}","alternation":"ya da","character_count":{"one":"{{count}} karakter","other":"{{count}} karakter"},"related_messages":{"title":"İlgili Mesajlar","see_all":"@%{username} kullanıcısından gelen \u003ca href=\"%{path}\"\u003ebütün mesajları\u003c/a\u003e gör..."},"suggested_topics":{"title":"Önerilen Konular","pm_title":"Önerilen Mesajlar"},"about":{"simple_title":"Hakkında","title":"%{title} Hakkında","stats":"Site İstatistikleri","our_admins":"Yöneticilerimiz","our_moderators":"Moderatörlerimiz","moderators":"Moderatörler","stat":{"all_time":"Tüm Zamanlar","last_7_days":"Son 7","last_30_days":"Son 30"},"like_count":"Beğeniler","topic_count":"Konular","post_count":"Gönderiler","user_count":"Kullanıcılar","active_user_count":"Aktif Kullanıcılar","contact":"Bize Ulaşın","contact_info":"Bu siteyi etkileyen ciddi bir sorun ya da acil bir durum oluştuğunda, lütfen %{contact_info} adresi üzerinden bizimle iletişime geç."},"bookmarked":{"title":"İşaret","clear_bookmarks":"İşaretlenenleri Temizle","help":{"bookmark":"Bu konudaki ilk gönderiyi işaretlemek için tıkla","unbookmark":"Bu konudaki tüm işaretlenenleri kaldırmak için tıkla"}},"bookmarks":{"created":"bu gönderiyi işaretledin","not_bookmarked":"bu yazıya yer işareti koy","remove":"İşareti Kaldır","confirm_clear":"Bu konudaki tüm yer işaretlerinizi silmek istediğinizden emin misiniz?","save":"Kaydet","no_timezone":"Henüz bir saat dilimi belirlemediniz. Hatırlatıcı ayarlayamazsınız. \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eProfilinizde\u003c/a\u003e bir tane oluşturun.","reminders":{"at_desktop":"Bir dahaki sefere masaüstümdeyim","later_today":"Bugün ilerleyen saatlerde","tomorrow":"Yarın","next_week":"Gelecek hafta","later_this_week":"Bu hafta içinde","next_month":"Gelecek ay","custom":"Özel tarih ve saat"}},"drafts":{"resume":"Sürdür","remove":"Kaldır","new_topic":"Yeni konu taslağı","new_private_message":"Yeni özel mesaj taslağı","topic_reply":"Cevap taslağı","abandon":{"confirm":"Halihazırda bu konuda bir taslağınız var. Ondan vazgeçmek istediğinden emin misin?","yes_value":"Evet, vazgeç","no_value":"Hayır, kalsın"}},"topic_count_latest":{"one":"{{count}} yeni ya da güncellenmiş konu.","other":"{{count}} yeni ya da güncellenmiş konu."},"topic_count_unread":{"one":"{{count}} Okunmamış konuyu görün","other":"{{count}} Okunmamış konuları görün"},"topic_count_new":{"one":"{{count}} Yeni Konu Gör","other":"{{count}} Yeni konular gör"},"preview":"önizleme","cancel":"iptal","save":"Değişiklikleri Kaydet","saving":"Kaydediliyor...","saved":"Kaydedildi!","upload":"Yükle","uploading":"Yükleniyor...","uploading_filename":"Yükleme: {{filename}}...","clipboard":"pano","uploaded":"Yüklendi!","pasting":"Yapıştırılıyor...","enable":"Etkinleştir","disable":"Devredışı Bırak","continue":"Devam et","undo":"Geri Al","revert":"Eski Haline Getir","failed":"Başarısız oldu","switch_to_anon":"Anonim Moda Geç","switch_from_anon":"Anonim Moddan Çık","banner":{"close":"Bu pankartı artık anımsatma","edit":"Bu pankartı düzenle \u003e\u003e"},"pwa":{"install_banner":"Bu cihazda \u003ca href\u003egüncellemek %{title} ister misiniz?\u003c/a\u003e"},"choose_topic":{"none_found":"Hiçbir konu bulunamadı.","title":{"search":"Konu Ara","placeholder":"konu başlığını, url\u0026#39;yi veya kimliği buraya yazın"}},"choose_message":{"none_found":"Mesaj bulunamadı.","title":{"search":"Mesaj Arama","placeholder":"mesaj başlığını, url\u0026#39;yi veya kimliği buraya yazın"}},"review":{"order_by":"Sırala","in_reply_to":"cevap olarak","explain":{"why":"bu makalenin neden sıraya girdiğini açıkla","title":"Gözden geçirilebilir Puanlama","formula":"Formül","subtotal":"ara toplam","total":"Toplam","min_score_visibility":"Görünürlük için Minimum Puan","score_to_hide":"Gönderiyi Gizlemek için Puan","take_action_bonus":{"name":"harekete geçti","title":"Bir personel harekete geçmeyi seçtiğinde bayrağa bonus verilir."},"user_accuracy_bonus":{"name":"kullanıcı doğruluğu","title":"Bayrakları tarihsel olarak kararlaştırılmış olanlara bonus verilir."},"trust_level_bonus":{"name":"güven seviyesi","title":"Güven düzeyi yüksek kullanıcılar tarafından oluşturulan, incelenebilir öğeler daha yüksek bir puana sahiptir."},"type_bonus":{"name":"tür bonusu","title":"Bazı gözden geçirilebilir türlere daha yüksek öncelikli olmaları için personel tarafından bir bonus tahsis edilebilir."}},"claim_help":{"optional":"Başkalarının incelemesini engellemek için bu öğeyi talep edebilirsiniz.","required":"Öğeleri inceleyebilmeniz için önce hak talebinde bulunmalısınız.","claimed_by_you":"Bu öğeyi talep ettiniz ve inceleyebilirsiniz.","claimed_by_other":"Bu öge yalnızca \u003cb\u003e{{username}}\u003c/b\u003e kullanıcısı tarafından incelenebilir."},"claim":{"title":"konu talebinde bulun"},"unclaim":{"help":"talebi iptal et"},"awaiting_approval":"Onay Bekleniyor","delete":"Sil","settings":{"saved":"Kaydedildi","save_changes":"Değişiklikleri Kaydet","title":"Ayarlar","priorities":{"title":"Görüntülenebilen Öncelikler"}},"moderation_history":"Moderasyon Tarihi","view_all":"Hepsini görüntüle","grouped_by_topic":"Konuya göre Gruplandı","none":"İncelenecek öge yok.","view_pending":"bekleyen görünüm","topic_has_pending":{"one":"Bu konuda \u003cb\u003e%{count}\u003c/b\u003e adet onay bekleyen gönderi var","other":"Bu konuda \u003cb\u003e{{count}}\u003c/b\u003e adet onay bekleyen gönderi var"},"title":"Gözden geçirmeler","topic":"Konu:","filtered_topic":"Tek konu içerisinde görüntülenebilir içerikleri filtrelediniz.","filtered_user":"Kullanıcı","show_all_topics":"bütün konuları göster","deleted_post":"(gönderi silindi)","deleted_user":"(kullanıcı silindi)","user":{"bio":"Profil","website":"İnternet sitesi","username":"Kullanıcı Adı","email":"Eposta","name":"İsim","fields":"Alanlar"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} toplam bildiri)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} toplam bildiri)"},"agreed":{"one":"%{{count}} uygunluk","other":"%{{count}} uygunluk"},"disagreed":{"one":"%{{count}} uygunsuz","other":"%{{count}} uygunsuz"},"ignored":{"one":"% {{count}} görmezden gelme","other":"%{{count}} görmezden gelme"}},"topics":{"topic":"Konu","reviewable_count":"say","reported_by":"Raporlayan","deleted":"[Konu Silindi]","original":"(asıl konu)","details":"ayrıntılar","unique_users":{"one":"%{count}kullanıcı","other":"{{count}}kullanıcı"}},"replies":{"one":"%{count}yanıt","other":"{{count}}yanıt"},"edit":"Düzenle","save":"Kaydet","cancel":"İptal","new_topic":"Bu öğeyi onaylamak yeni bir konu yaratacaktır","filters":{"all_categories":"(tüm kategoriler)","type":{"title":"Tür","all":"(bütün tipler)"},"minimum_score":"En Düşük Skor:","refresh":"Yenile","status":"Durum","category":"Kategori","orders":{"priority":"Öncelik","priority_asc":"Öncelik (ters)","created_at":"İçinde Oluşturuldu","created_at_asc":"İçinde Oluşturuldu (tersine)"},"priority":{"title":"En Düşük Öncelik","low":"(hiç)","medium":"Orta","high":"Yüksek"}},"conversation":{"view_full":"sohbetin hepsini görüntüle"},"scores":{"about":"Bu skor rapor eden kişinin güven seviyesine, başarımlarının doğruluğuna ve raporlanan maddenin önceliğine göre hesaplanır.","score":"Skor","date":"Tarih","type":"Tür","status":"Durum","submitted_by":"Gönderen","reviewed_by":"İnceleyen"},"statuses":{"pending":{"title":"Bekleyen"},"approved":{"title":"Onaylandı"},"rejected":{"title":"Reddedildi"},"ignored":{"title":"Yoksayıldı"},"deleted":{"title":"Silindi"},"reviewed":{"title":"(hepsi görüldü) "},"all":{"title":"(her şey)"}},"types":{"reviewable_flagged_post":{"title":"Bildirilmiş Gönderi","flagged_by":"Bildiren"},"reviewable_queued_topic":{"title":"Kuyruğa Eklenmiş Konu"},"reviewable_queued_post":{"title":"Kuyruğa Eklenmiş Gönderi"},"reviewable_user":{"title":"Kullanıcı"}},"approval":{"title":"Gönderi Onay Gerektirir","description":"Yeni gönderini aldık fakat gösterilmeden önce moderatör tarafından onaylanması gerekiyor. Hoşgörün için teşekkür ederiz. ","pending_posts":{"one":"Bekleyen \u003cstrong\u003e%{count}\u003c/strong\u003e gönderiniz var.","other":"Bekleyen \u003cstrong\u003e{{count}}\u003c/strong\u003e gönderiniz var."},"ok":"Tamam"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003ekonuyu\u003c/a\u003e açtı","you_posted_topic":"\u003ca href='{{topicUrl}}'\u003ekonuyu\u003c/a\u003e \u003ca href='{{userUrl}}'\u003esen\u003c/a\u003e açtın","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e gönderiyi cevapladı","you_replied_to_post":"\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e gönderiyi \u003ca href='{{userUrl}}'\u003esen\u003c/a\u003e cevapladın","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003ekonuya\u003c/a\u003e cevap verdi","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eSen\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003ekonuya\u003c/a\u003e cevap verdin","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e adlı kullanıcıdan bahsetti","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{user2Url}}'\u003esizden\u003c/a\u003e bahsetti","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eSen\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e adlı kullanıcıdan bahsettin","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tarafından gönderildi","posted_by_you":"\u003ca href='{{userUrl}}'\u003eSenin \u003c/a\u003e tarafından gönderildi","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e tarafından gönderildi","sent_by_you":"\u003ca href='{{userUrl}}'\u003eSenin\u003c/a\u003e tarafından gönderildi"},"directory":{"filter_name":"kullanıcı adına göre filtrele","title":"Kullanıcılar","likes_given":"Verilen","likes_received":"Alınan","topics_entered":"Görüntülenen","topics_entered_long":"Görüntülenen Konular","time_read":"Okuma Zamanı","topic_count":"Konular","topic_count_long":"Oluşturulan Konular","post_count":"Cevaplar","post_count_long":"Gönderilen Cevaplar","no_results":"Hiçbir sonuç bulunamadı.","days_visited":"Ziyaretler","days_visited_long":"Ziyaret edilen günler","posts_read":"Okunan","posts_read_long":"Okunan Gönderiler","total_rows":{"one":"%{count} kullanıcı","other":"%{count} kullanıcı"}},"group_histories":{"actions":{"change_group_setting":"Grup ayarlarını değiştir","add_user_to_group":"Kullanıcı ekle","remove_user_from_group":"Kullanıcıyı kaldır","make_user_group_owner":"Sahibi yap","remove_user_as_group_owner":"Sahipliğini İptal Et"}},"groups":{"member_added":"Eklendi","member_requested":"İstenen","add_members":{"title":"Üyeleri ekle","description":"Bu grubun üyeliğini yönet","usernames":"Kullanıcı adları"},"requests":{"title":"İstekler","reason":"Sebep","accept":"Onayla","accepted":"onaylanmış","deny":"Reddet","denied":"reddedildi","undone":"istek reddedildi","handle":"üyelik isteğini yerine getir"},"manage":{"title":"Yönet","name":"İsim","full_name":"Tam İsim","add_members":"Üyeleri ekle","delete_member_confirm":"'%{username}' adlı kullanıcıyı '%{group}' grubundan çıkart?","profile":{"title":"Profil"},"interaction":{"title":"Etkileşim","posting":"Gönderiliyor","notification":"Bildirim"},"membership":{"title":"Üyelik","access":"Erişim"},"logs":{"title":"Kayıtlar","when":"Ne zaman","action":"Eylem","acting_user":"Temsili kullanıcı","target_user":"Hedef Kullanıcı","subject":"Konu","details":"Ayrıntılar","from":"Kimden","to":"Kime"}},"public_admission":"Kullanıcıların gruba ücretsiz olarak katılmalarına izin ver (Grubun herkese açık olması gerekiyor)","public_exit":"Kullanıcıların gruptan ücretsiz olarak ayrılmalarına izin ver","empty":{"posts":"Bu grubun üyeleri henüz bir gönderi yapmamış.","members":"Bu grupta henüz hiç üye bulunmuyor. ","requests":"Bu grup için üyelik isteği yok.","mentions":"Henüz bu gruptan kimse söz etmemiş.","messages":"Henüz bu grup için hiç mesaj bulunmuyor. ","topics":"Bu grubun üyeleri tarafından oluşturulmuş herhangi bir konu bulunmuyor. ","logs":"Bu grup için herhangi bir kayıt bulunmuyor. "},"add":"Ekle","join":"Katıl","leave":"Ayrıl","request":"İstek","message":"Mesaj","confirm_leave":"Bu gruptan ayrılmak istediğinizden emin misiniz?","allow_membership_requests":"Kullanıcıların grup sahiplerine üyelik istekleri göndermesine izin ver (Genel olarak görünür grup gerektirir)","membership_request_template":"Üyelik talebi gönderirken kullanıcılara gösterilen özel şablon","membership_request":{"submit":"Talep gönderimi","title":"@%{group_name} için katılım talebi ","reason":"Grup sahiplerine bu gruba neden üye olduğunu bildir"},"membership":"Üyelik","name":"İsim","group_name":"Grup adı","user_count":"Kullanıcılar","bio":"Grup Hakkında","selector_placeholder":"kullanıcı adı girin","owner":"sahip","index":{"title":"Gruplar","all":"Tüm Gruplar","empty":"Görünen hiçbir grup bulunmuyor. ","filter":"Grup tipine göre filtrele","owner_groups":"Sahip olduğum gruplar","close_groups":"Kapanmış Gruplar","automatic_groups":"Otomatik Gruplar","automatic":"Otomatik","closed":"Kapanmış","public":"Herkese Açık","private":"Özel","public_groups":"Açık Gruplar","automatic_group":"Otomatik Grup","close_group":"Kapalı grup","my_groups":"Gruplarım","group_type":"Grup türü","is_group_user":"Üye","is_group_owner":"Sahip"},"title":{"one":"Gruplar","other":"Gruplar"},"activity":"Aktivite","members":{"title":"Üyeler","filter_placeholder_admin":"kullanıcı adı ya da e-posta","filter_placeholder":"kullanıcı adı","remove_member":"Üyeyi çıkar","remove_member_description":"%{username} üyeyi bu guptan çıkar","make_owner":"Sahibi Yap","make_owner_description":" \u003cb\u003e%{username}\u003c/b\u003e bu grubun sahibi yap","remove_owner":"Sahiplikten kaldır","remove_owner_description":"\u003cb\u003e%{username}\u003c/b\u003e grubun sahibi olmaktan çıkar","owner":"Sahip","forbidden":"Üyeleri görmek için yetkiniz yok."},"topics":"Konular","posts":"Gönderiler","mentions":"Bahsedilenler","messages":"Mesajlar","notification_level":"Grup mesajları için varsayılan bildirim seviyesi","alias_levels":{"mentionable":"Bu gruptan kimler @bahsedebilir?","messageable":"Bu gruba kimler mesaj gönderebilir?","nobody":" Hiç kimse","only_admins":"Sadece Yöneticiler","mods_and_admins":"Sadece Moderatörler ve Yöneticiler","members_mods_and_admins":"Sadece Grup Üyeleri, Moderatörler ve Yöneticiler","owners_mods_and_admins":"Sadece grup sahipleri, moderatörler ve yöneticiler","everyone":"Herkes"},"notifications":{"watching":{"title":"İzleniyor","description":"Her mesajda her yeni gönderi hakkında bilgilendirileceksin ve yeni cevap sayısı gösterilecek."},"watching_first_post":{"title":"İlk Gönderi İzlenmesi","description":"Bu gruptaki yeni mesajlar için bilgilendirileceksiniz. (Cevaplar dışında)"},"tracking":{"title":"Takip ediliyor","description":"Herhangi biri @isminden bahseder ya da sana cevap verirse bildirim alacaksın ve yeni cevap sayısını göreceksin."},"regular":{"title":"Normal","description":"Herhangi biri @isminden bahseder ya da sana cevap verirse bildirim alacaksın"},"muted":{"title":"Sessiz","description":"Bu gruptaki bütün mesajlarla ilgili bilgilendirileceksiniz."}},"flair_url":"Avatar Resmi","flair_url_placeholder":"(İsteğe bağlı) Resim URL'si veya Font Awesome Class'ı","flair_url_description":"Kullanılan kare resimler ve FontAwesome ikonu 20x20px'den küçük olamaz (Kabul edilen formatlar: \"fa-icon\", \"far fa-icon\" veya \"fab fa-icon\").","flair_bg_color":"Avatar Arkaplan Rengi","flair_bg_color_placeholder":"(İsteğe bağlı) Hex renk değeri","flair_color":"Avatar Rengi","flair_color_placeholder":"(İsteğe bağlı) Hex renk değeri","flair_preview_icon":"İkonu önizle","flair_preview_image":"Resmi önizle"},"user_action_groups":{"1":"Beğenilenler","2":"Alınan Beğeniler","3":"İşaretlenenler","4":"Konular","5":"Cevaplar","6":"Yanıtlar","7":"Bahsedilenler","9":"Alıntılar","11":"Düzenlemeler","12":"Gönderilmiş öğeler","13":"Gelen Kutusu","14":"Bekleyen","15":"Taslaklar"},"categories":{"all":"tüm kategoriler","all_subcategories":"tüm","no_subcategory":"hiçbiri","category":"Kategori","category_list":"Kategori listesini göster","reorder":{"title":"Kategorileri Yeniden Talep Et","title_long":"Kategori listesini yeniden düzenle","save":"Talebi Kaydet","apply_all":"Uygula","position":"Konum"},"posts":"Gönderiler","topics":"Konular","latest":"En Son","latest_by":"son gönderen","toggle_ordering":"talep kontrolünü değiştir","subcategories":"Alt kategoriler","topic_sentence":{"one":"%{count} konu","other":"%{count} konu"},"topic_stat_sentence_week":{"one":"geçen haftadan beri%{count} yeni konu.","other":"geçen haftadan beri %{count} yeni konu."},"topic_stat_sentence_month":{"one":"geçen aydan beri %{count} yeni konu.","other":"%{count} geçen ay yeni konular."},"n_more":"Kategoriler (%{count}daha fazla) ..."},"ip_lookup":{"title":"IP Adresi Ara","hostname":"Sunucu ismi","location":"Lokasyon","location_not_found":"(bilinmeyen)","organisation":"Organizasyon","phone":"Telefon","other_accounts":"Bu IP adresine sahip diğer hesaplar:","delete_other_accounts":"Sil %{count}","username":"kullanıcı adı","trust_level":"TL","read_time":"okunma süresi","topics_entered":"girilen konular","post_count":"# gönderi","confirm_delete_other_accounts":"Bu hesapları silmek isteğine emin misin?","powered_by":"kullanılıyor \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"kopyalanan"},"user_fields":{"none":"(bir seçenek tercih et)"},"user":{"said":"{{username}}:","profile":"Profil","mute":"Sessiz","edit":"Tercihleri Düzenle","download_archive":{"button_text":"Hepsini İndir","confirm":"Gönderilerini indirmek istediğine emin misin?","success":"İndirme işlemi başlatıldı. İşlem tamamlandığında mesaj ile bilgilendirileceksin.","rate_limit_error":"Gönderiler günde bir kez indirilebilir, lütfen yarın tekrar dene. "},"new_private_message":"Yeni Mesaj","private_message":"Mesaj","private_messages":"Mesajlar","user_notifications":{"ignore_duration_title":"Zamanlayıcıyı Yoksay","ignore_duration_username":"Kullanıcı Adı","ignore_duration_when":"Süre:","ignore_duration_save":"Yoksay","ignore_duration_note":"Lütfen yoksayma süresi dolduktan sonra tüm yoksaymaların otomatik olarak kaldırıldığını unutmayın.","ignore_duration_time_frame_required":"Bir zaman dilimi seç","ignore_no_users":"Yoksaydığınız kullanıcı bulunmuyor.","ignore_option":"Yoksayıldı","ignore_option_title":"Bu kullanıcıyla ilgili bildirimleri almayacaksınız ve kullanıcının tüm başlık ve cevapları gizlenecek.","add_ignored_user":"Ekle...","mute_option":"Sessiz","mute_option_title":"Bir daha bu kullanıcıyla ilgili bildirim almayacaksın.","normal_option":"Normal","normal_option_title":"Bu kullanıcı sizi yanıtlarsa, alıntılarsa ya da sizden bahsederse bildirim alacaksınız."},"activity_stream":"Aktivite","preferences":"Tercihler","feature_topic_on_profile":{"open_search":"Yeni Bir Konu Seçin","title":"Bir konu seç","search_label":"Başlığı konuya göre ara","save":"Kaydet","clear":{"title":"Temizle","warning":"Öne çıkmış olan konunuzu silmek istediğinizden emin misiniz?"}},"profile_hidden":"Bu kullanıcının genel profili gizli.","expand_profile":"Genişlet","collapse_profile":"Daralt","bookmarks":"İşaretlenenler","bio":"Hakkımda","timezone":"Saat dilimi","invited_by":"Tarafından Davet Edildi","trust_level":"Güven Seviyesi","notifications":"Bildirimler","statistics":"İstatistikler","desktop_notifications":{"label":"Canlı Bildirimler","not_supported":"Bildirimler bu tarayıcıda desteklenmiyor. Üzgünüz.","perm_default":"Bildirimleri Etkinleştir","perm_denied_btn":"Erişim İzni Reddedildi","perm_denied_expl":"Bildirimler için izinleri reddettin. Bildirimlere, tarayıcı ayarlarından izin verebilirsin. ","disable":"Bildirimleri Devre Dışı Bırak","enable":"Bildirimleri Etkinleştir","each_browser_note":"Not: Bu ayarı kullandığın her tarayıcıda değiştirmelisin.","consent_prompt":"Gönderilerine cevap verildiğinde anlık bildirim almak ister misin?"},"dismiss":"Yoksay","dismiss_notifications":"Tümünü Yoksay","dismiss_notifications_tooltip":"Tüm okunmamış bildirileri okunmuş olarak işaretle","first_notification":"İlk bildirimin! Başlamak için seç. ","dynamic_favicon":"Sayacı, tarayıcı ikonunda göster","theme_default_on_all_devices":"Bu temayı bütün cihazlarımda varsayılan yap","text_size_default_on_all_devices":"Bu metin boyutunu bütün cihazlarımda varsayılan yap","allow_private_messages":"Diğer kullanıcıların bana kişisel mesaj göndermesine izin ver","external_links_in_new_tab":"Tüm dış bağlantıları yeni sekmede aç","enable_quoting":"Bahsedilen konu için yanıtlama özelliğini etkinleştir","enable_defer":"Okunmamış konuları işaretlemek için ertelemeyi aktif edin","change":"değiştir","featured_topic":"Öne Çıkan Konu","moderator":"{{user}} moderatördür","admin":"{{user}} yöneticidir","moderator_tooltip":"Bu kullanıcı moderatördür","admin_tooltip":"Bu kullanıcı yöneticidir.","silenced_tooltip":"Bu kullanıcı sessize alındı. ","suspended_notice":"Bu kullanıcı {{date}} tarihine kadar beklemeye alındı. ","suspended_permanently":"Bu kullanıcı beklemeye alındı.","suspended_reason":"Sebep:","github_profile":"Github","email_activity_summary":"Aktivite özeti","mailing_list_mode":{"label":"Gönderi listesi modu","enabled":"Gönderi listesi modunu etkinleştir","instructions":"Bu ayar aktivite özetini geçersiz kılar.\u003cbr /\u003e\nSessize alınmış konular ve kategoriler bu e-postalarda yer almaz. \n","individual":"Her yeni gönderi için bir e-posta gönder","individual_no_echo":"Kendi gönderilerim haricindeki her gönderi için e-posta gönder","many_per_day":"Her yeni gönderi için bir e-posta gönder (günde yaklaşık {{dailyEmailEstimate}}).","few_per_day":"Her yeni gönderi için bana e-posta gönder ( günlük yaklaşık 2 )","warning":"Gönderi listesi modu etkin. E-posta bildirim ayarları geçersiz kılınmış."},"tag_settings":"Etiketler","watched_tags":"İzlendi","watched_tags_instructions":"Bu etiketlerdeki tüm konuları otomatik olarak izleyeceksin. Tüm yeni gönderi ve konulardan haberdar olacak ve yeni gönderilerin sayısını konunun yanında göreceksin. ","tracked_tags":"Takipte","tracked_tags_instructions":"Bu etiketlerdeki tüm konuları otomatik olarak takip edeceksin. Yeni gönderilerin sayısını konunun yanında göreceksin. ","muted_tags":"Sessiz","muted_tags_instructions":"Bu etiketlerdeki yeni konular hakkında herhangi bir bildirim almayacaksın ve en son gönderilerde de bunlar gözükmeyecek.","watched_categories":"İzlendi","watched_categories_instructions":"Bu kategorilerdeki tüm konuları otomatik olarak izleyeceksin. Tüm yeni gönderi ve konu başlıklarından haberdar olacak ve yeni gönderilerin sayısını konu başlıklarının yanında göreceksin. ","tracked_categories":"Takipte","tracked_categories_instructions":"Bu kategorilerdeki tüm konuları otomatik olarak takip edeceksin. Yeni gönderilerin sayısını da konunun yanında göreceksin.","watched_first_post_categories":"İlk gönderiyi izleme","watched_first_post_categories_instructions":"Bu kategorilerdeki tüm yeni konu başlıklarının ilk gönderilerinde bildirim alacaksın. ","watched_first_post_tags":"İlk gönderiyi izleme","watched_first_post_tags_instructions":"Bu etiketlerdeki her yeni konu başlığındaki ilk gönderi için bildirim alacaksın. ","muted_categories":"Sessiz","muted_categories_instructions":"Bu kategorilerdeki yeni konular hakkında bildirim almayacaksınız ve son soyfalarda görmeyeceksiniz.","muted_categories_instructions_dont_hide":"Bu kategorilerdeki yeni konular hakkında hiçbir şey size bildirilmeyecek.","no_category_access":"Bir moderatör olarak kategori erişimin sınırlı ve kaydetme devre dışıdır.","delete_account":"Hesabımı Sil","delete_account_confirm":"Hesabını kalıcı olarak silmek istediğine emin misin? Bu eylemi geri alamazsın!","deleted_yourself":"Hesabın başarıyla silindi.","delete_yourself_not_allowed":"Hesabının silinmesini istiyorsan lütfen bir personelle iletişime geç. ","unread_message_count":"Mesajlar","admin_delete":"Sil","users":"Kullanıcılar","muted_users":"Sessiz","muted_users_instructions":"Bu kullanıcılardan gelen tüm bildirileri kapa.","ignored_users":"Yoksayıldı","ignored_users_instructions":"Bu kullanıcıdan gelen tüm gönderileri ve bildirimleri engelleyin.","tracked_topics_link":"Göster","automatically_unpin_topics":"Sayfa sonuna geldiğimde en yukarıda sabitlenmiş tüm konuları kaldır. ","apps":"Uygulamalar","revoke_access":"Erişimi İptal Et","undo_revoke_access":"Erişim İptalini Geri Al","api_approved":"Onaylanmış:","api_last_used_at":"Son kullanılan:","theme":"Tema","home":"Varsayılan Anasayfa","staged":"Aşamalı","staff_counters":{"flags_given":"yardımcı bayraklar","flagged_posts":"bayraklı gönderiler","deleted_posts":"silinen gönderiler","suspensions":"ertelenenler","warnings_received":"uyarılar"},"messages":{"all":"Hepsi","inbox":"Gelen Kutusu","sent":"Gönderilen","archive":" Arşiv","groups":"Gruplarım","bulk_select":"Mesajları seç","move_to_inbox":"Gelen kutusuna taşı","move_to_archive":" Arşiv","failed_to_move":"Seçilen mesajların taşınması başarısız oldu (muhtemelen şebeke çöktü)","select_all":"Tümünü seç","tags":"Etiketler"},"preferences_nav":{"account":"Hesap","profile":"Profil","emails":"E-postalar","notifications":"Bildirimler","categories":"Kategoriler","users":"Kullanıcılar","tags":"Etiketler","interface":"Arayüz","apps":"Uygulamalar"},"change_password":{"success":"(e-posta gönderildi)","in_progress":"(e-posta gönderiliyor)","error":"(hata)","action":"Şifre Sıfırlama E-postası Gönder","set_password":"Şifre Belirle","choose_new":"Yeni bir şifre seç","choose":"Şifre seç"},"second_factor_backup":{"title":"İki Faktörlü Yedekleme Kodu","regenerate":"Yeniden oluştur","disable":"Devre dışı bırak","enable":"Etkinleştir","enable_long":"Yedek kodları etkinleştir","manage":"Yedek kodları yönet.  \u003cstrong\u003e{{count}}\u003c/strong\u003e yedek kod kaldı.","copied_to_clipboard":"Panoya kopyalandı","copy_to_clipboard_error":"Panoya kopyalanırken hata oluştu","remaining_codes":"\u003cstrong\u003e{{count}}\u003c/strong\u003e yedek kodun kaldı ","use":"Bir yedekleme kodu kullanın","enable_prerequisites":"Yedek kodları oluşturmadan önce birincil ikinci faktörü etkinleştirmelisiniz.","codes":{"title":"Yedek kod oluşturuldu","description":"İlgili yedek kodlar sadece bir kez kullanılabilir. Kodları güvenli ama erişilebilir bir yerde tutmalısın. "}},"second_factor":{"title":"İki Faktörlü Kimlik Doğrulama","enable":"İki Adımlı Kimlik Doğrulamayı Düzenle","forgot_password":"Şifrenizi mi unuttunuz?","confirm_password_description":"Devam etmek için lütfen şifrenizi onaylayın","name":"İsim","label":"Kod","rate_limit":"Yeni bir doğrulama kodu girmeden önce lütfen bekleyin.","enable_description":"Bu QR kodunu desteklenen bir uygulamada tarayın (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) ve doğrulama kodunuzu girin.\n","disable_description":"Lütfen kimlik doğrulama kodunu \"Uygulama\"dan gir","show_key_description":"Manuel olarak gir","short_description":"Hesabınızı tek kullanımlık güvenlik kodlarıyla koruyun.\n","extended_description":"İki faktörlü kimlik doğrulama, şifrenize ek olarak bir kerelik bir belirteç gerektirerek hesabınıza ekstra güvenlik sağlar. Tokenler \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e ve \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e cihazlarda yaratılabilir.\n","oauth_enabled_warning":"Hesabınızda iki faktörlü kimlik doğrulaması etkinleştirildikten sonra sosyal girişlerin devre dışı bırakılacağını lütfen unutmayın.","use":"Authenticator uygulamasını kullan","enforced_notice":"Bu siteye erişmeden önce iki faktörlü kimlik doğrulamasını etkinleştirmeniz gerekir.","disable":"devre dışı bırak","disable_title":"İkinci Faktör İnaktif","disable_confirm":"Bütün ikinci faktörleri inaktifleştirmek istediğinize emin misiniz?","edit":"Düzenle","edit_title":"İkinci Faktörü Düzenle","edit_description":"İkinci Faktör Adı","enable_security_key_description":"Fiziksel güvenlik anahtarınızı hazırladığınızda, aşağıdaki Kayıt düğmesine basın.","totp":{"title":"Token Tabanlı Doğrulayıcılar","add":"Yeni Doğrulayıcı","default_name":"Benim Doğrulayıcım"},"security_key":{"register":"Kayıt Ol","title":"Güvenlik Sözcükleri","add":"Güvenlik Anahtarını Kaydedin","default_name":"Ana Güvenlik Anahtarı","not_allowed_error":"Güvenlik anahtarı kayıt işlemi zaman aşımına uğradı veya iptal edildi.","already_added_error":"Bu güvenlik anahtarın daha önce kaydettiğiniz için tekrar kaydetmeniz gerekmez.","edit":"Güvenlik Anahtarını Düzenle","edit_description":"Güvenlik Anahtarı Adı","delete":"Sil"}},"change_about":{"title":"\"Hakkımda\"yı Değiştir","error":"Bu değeri değiştirirken bir hata oluştu."},"change_username":{"title":"\"Kullanıcı Adı\"nı Değiştir","confirm":"\"Kullanıcı Adı\"nı değiştirmek istediğine emin misin?","taken":"Üzgünüz, bu kullanıcı adı daha önce alınmış. ","invalid":"Bu kullanıcı adı geçersiz. Kullanıcı adı, sadece sayı ve harf içerebilir. "},"change_email":{"title":"\"E-posta Adresi\"ni Değiştir","taken":"Üzgünüz, bu e-posta kullanılabilir değil.","error":"\"E-posta Adresi\"ni değiştirirken bir hata oluştu. Bu adres zaten kullanımda olabilir! ","success":"Adresine bir e-posta gönderdik. Lütfen onaylama talimatlarını takip et.","success_staff":"Şu anki adresine bir e-posta gönderdik. Lütfen doğrulama bilgilendirmelerini takip et."},"change_avatar":{"title":"Profil resmini değiştir","letter_based":"Sistem profil görseli atadı","uploaded_avatar":"Kişisel resim","uploaded_avatar_empty":"Kişisel bir resim ekle","upload_title":"Resmini yükle","image_is_not_a_square":"Uyarı: Genişliği ve yüksekliği eşit olmadığı için görseli kesmek durumunda kaldık."},"change_profile_background":{"title":"Profil Başlığı","instructions":"Profil başlıkları ortalanacak ve varsayılan olarak 1110 piksel boyutunda olacaktır."},"change_card_background":{"title":"Kullanıcı Kartı Arkaplanı","instructions":"Profil arkaplanları ortalanacak ve genişliği 590px olacak. "},"change_featured_topic":{"title":"Öne Çıkan Konu","instructions":"Bu konunun bağlantısı kullanıcı kartınızda ve profilinizde olacaktır."},"email":{"title":"E-posta","primary":"Öncelikli E-posta","secondary":"İkincil E-postalar","no_secondary":"İkincil e-posta adresi mevcut değil","sso_override_instructions":"E-posta SSO sağlayıcısından güncellenebilir.","instructions":"Hiç kimseye gösterilmedi.","ok":"Onaylaman için sana e-posta göndereceğiz","invalid":"Lütfen geçerli bir e-posta adresi gir","authenticated":"E-posta adresin {{provider}} tarafından doğrulandı","frequency_immediately":"Eğer göndermek üzere olduğumuz e-postayı okuyamadıysan sana direkt e-posta göndereceğiz. ","frequency":{"one":"Sadece son {{count}} dakika içinde sizi görmediysek e-posta yollayacağız.","other":"Eğer seni sadece son {{count}} dakika içinde görmediysek sana bir e-posta göndereceğiz. "}},"associated_accounts":{"title":"İlişkili Hesaplar","connect":"Bağlan","revoke":"İptal","cancel":"İptal","not_connected":"(bağlı değil)","confirm_modal_title":"Bağlan%{provider} Hesap","confirm_description":{"account_specific":"Sizin %{provider} hesabınız '%{account_description}' doğrulama için kullanılacak.","generic":"Sizin %{provider} hesabınız doğrulama için kullanılacak."}},"name":{"title":"İsim","instructions":"tam adın (opsiyonel)","instructions_required":"Tam adın","too_short":"İsmin çok kısa","ok":"İsmin iyi görünüyor"},"username":{"title":"Kullanıcı adı","instructions":"Benzersiz, boşluksuz, kısa","short_instructions":"Kullanıcılar senden @{{username}} olarak bahsedebilirler","available":"Kullanıcı adı müsait","not_available":"Uygun değil. Şunu denemeni öneririz: {{suggestion}} ","not_available_no_suggestion":"Kullanılabilir değil","too_short":"Kullanıcı adın çok kısa","too_long":"Kullanıcı adın çok uzun","checking":"Kullanıcı adı müsait mi kontrol ediliyor...","prefilled":"E-posta bu kullanıcı adı ile eşleşiyor"},"locale":{"title":"Arayüz dili","instructions":"Kullanıcı arayüz dili. Sayfayı yenilediğin zaman değişecek. ","default":"(varsayılan)","any":"hiçbir"},"password_confirmation":{"title":"Şifre tekrarı"},"auth_tokens":{"title":"Son Kullanılan Cihazlar","ip":"IP","details":"Detaylar","log_out_all":"Hepisini Çıkış Yap","active":"şimdi aktif","not_you":"Sen değil?","show_all":"Tümünü göster ({{count}})","show_few":"Daha az göster","was_this_you":"Bu sen miydin?","was_this_you_description":"Siz değilseniz, şifrenizi değiştirmenizi ve her yerden oturumu kapatmanızı öneririz.","browser_and_device":"{{browser}} şunda {{device}}","secure_account":"Hesabımı güven altına al","latest_post":"En son gönderdiğiniz ..."},"last_posted":"Son Gönderi","last_emailed":"Gönderilen Son E-posta","last_seen":"Görüldü","created":"Katıldı","log_out":"Oturumu Kapat","location":"Lokasyon","website":"Web Sitesi","email_settings":"E-posta","hide_profile_and_presence":"Herkese açık profilimi ve durum özelliklerini gizle","enable_physical_keyboard":"iPad'de fiziksel klavye desteğini etkinleştir","text_size":{"title":"Yazı Boyutu","smaller":"Daha küçük","normal":"Normal","larger":"Daha büyük","largest":"En büyük"},"title_count_mode":{"title":"Arka plan sayfası başlığı aşağıdakilerin sayısını gösterir:","notifications":"Yeni bildirimler","contextual":"Yeni sayfa içeriği"},"like_notification_frequency":{"title":"Beğenildiğinde bildir","always":"Her zaman","first_time_and_daily":"Günlük olarak bir gönderi ilk kez beğenildiğinde","first_time":"Gönderi ilk kez beğenildiğinde","never":"Asla"},"email_previous_replies":{"title":"Önceki cevapları e-postaların sonuna ekle","unless_emailed":"daha önce gönderilmedi ise","always":"her zaman","never":"asla"},"email_digests":{"title":"Burayı ziyaret etmediğimde, bana popüler konuların ve yanıtların bir özetini gönder","every_30_minutes":"Her 30 dakikada","every_hour":"saatlik","daily":"günlük","weekly":"haftalık","every_month":"her ay","every_six_months":"her altı ayda bir"},"email_level":{"title":"Herhangi biri gönderimi yanıtladığında, benden alıntı yaptığında, @kullanıcıadı şeklinde bahsettiğinde ya da beni bir konuya davet ettiğinde bana e-posta gönder","always":"her zaman","only_when_away":"sadece uzaktayken","never":"asla"},"email_messages_level":"Herhangi biri bana mesaj yazdığında bana e-posta gönder","include_tl0_in_digests":"Yeni kullanıcılardan gelen içeriği özet e-postalarına ekle","email_in_reply_to":"Gönderilere gelen cevapların bir örneğini e-postaya ekle","other_settings":"Diğer","categories_settings":"Kategoriler","new_topic_duration":{"label":"Konuları şu durumda yeni kabul et","not_viewed":"Onları henüz görüntülemedim","last_here":"son ziyaretimden beri oluşturulanlar","after_1_day":"son 1 gün içinde oluşturulanlar","after_2_days":"son 2 gün içinde oluşturulanlar","after_1_week":"son 1 hafta içinde oluşturulanlar","after_2_weeks":"son 2 hafta içinde oluşturulanlar"},"auto_track_topics":"Girdiğim konuları otomatik olarak takip et","auto_track_options":{"never":"asla","immediately":"hemen","after_30_seconds":"30 saniye sonra","after_1_minute":"1 dakika sonra","after_2_minutes":"2 dakika sonra","after_3_minutes":"3 dakika sonra","after_4_minutes":"4 dakika sonra","after_5_minutes":"5 dakika sonra","after_10_minutes":"10 dakika sonra"},"notification_level_when_replying":"Bir konuya gönderi yaptığımda, konuyu şuna ayarla","invited":{"search":"davet etmek için yaz...","title":"Davetler","user":"Davet Edilen Kullanıcı","sent":"Son Gönderilen","none":"Görüntülenebilecek bir davet mevcut değil.","truncated":{"one":"İlk {{count}} davet gösteriliyor.","other":"İlk {{count}} davet gösteriliyor."},"redeemed":"Kabul Edilen Davetler","redeemed_tab":"Kabul Edildi","redeemed_tab_with_count":"Kabul edildi ({{count}})","redeemed_at":"Kabul Edildi","pending":"Bekleyen Davetler","pending_tab":"Bekleyen","pending_tab_with_count":"Beklemede ({{count}})","topics_entered":"Görüntülenen Konular","posts_read_count":"Okunmuş Gönderi","expired":"Bu davetin süresi doldu.","rescind":"Kaldır","rescinded":"Davet kaldırıldı","rescind_all":"Süresi Dolan Davetleri Kaldır","rescinded_all":"Tüm Süresi Dolmuş Davetiyeler kaldırıldı!","rescind_all_confirm":"Süresi dolmuş tüm davetiyeleri kaldırmak istediğinizden emin misiniz?","reinvite":"Daveti Tekrar Gönder","reinvite_all":"Tüm davetleri tekrar gönder","reinvite_all_confirm":"Tüm davetleri tekrar göndermek istediğine emin misin?","reinvited":"Davet tekrar gönderildi","reinvited_all":"Tüm davetler tekrar gönderildi!","time_read":"Okunma Zamanı","days_visited":"Ziyaret Edilen Gün","account_age_days":"Günlük hesap yaşı","create":"Davet Gönder","generate_link":"Davet Bağlantısını Kopyala","link_generated":"Davet bağlantısı başarılı bir şekilde oluşturuldu! ","valid_for":"Davet bağlantısı sadece bu adres için geçerli: %{email}","bulk_invite":{"none":"Henüz hiç kimseyi davet etmedin. Kişsel davet gönderebilir ya da \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eCSV dosyası yüklerek\u003c/a\u003e birden fazla kişiyi davet edebilirsin. ","text":"Dosyadan Toplu Davet Gönder","success":"Dosya başarıyla yüklendi. İşlem tamamlandığında mesaj yoluyla bilgilendirileceksin.","error":"Üzgünüz, dosya CSV formatında olmalı. ","confirmation_message":"Yüklenen dosyadaki herkese davetleri e-posta ile göndermek üzeresiniz."}},"password":{"title":"Şifre","too_short":"Şifren çok kısa","common":"Bu şifre çokça kullanılan bir şifre","same_as_username":"Şifren kullanıcı adınla aynı.","same_as_email":"Şifren e-posta adresinle aynı.","ok":"Şifren iyi gözüküyor.","instructions":"en az %{count} karakter"},"summary":{"title":"Özet","stats":"İstatistik","time_read":"okunma süresi","recent_time_read":"son okunma süresi","topic_count":{"one":"oluşturulan konular","other":"oluşturulan konular"},"post_count":{"one":"oluşturulan gönderiler","other":"oluşturulan gönderiler"},"likes_given":{"one":"verilen","other":"verilen"},"likes_received":{"one":"alınan","other":"alınan"},"days_visited":{"one":"ziyaret edilen gün","other":"günlük ziyaret"},"topics_entered":{"one":"görüntülenmiş başlıklar","other":"görüntülenmiş konular"},"posts_read":{"one":"okunmuş gönderi","other":"okunmuş gönderi"},"bookmark_count":{"one":"imler","other":"işaretliler"},"top_replies":"En çok cevaplananlar","no_replies":"Henüz cevaplanmamış ","more_replies":"Daha fazla cevap","top_topics":"En çok konuşulan konular","no_topics":"Henüz konu bulunmuyor.","more_topics":"Daha fazla konu","top_badges":"En tepedeki rozetler","no_badges":"Henüz rozet bulunmuyor.","more_badges":"Daha fazla rozet","top_links":"En çok kullanılan bağlantılar","no_links":"Henüz bir bağlantı bulunmuyor.","most_liked_by":"En Çok Beğenen","most_liked_users":"En Çok Beğenilen","most_replied_to_users":"En Çok Cevaplanan","no_likes":"Henüz beğeni bulunmuyor.","top_categories":"En Çok Konuşulan Kategoriler","topics":"Konular","replies":"Cevaplar"},"ip_address":{"title":"Son IP Adresi"},"registration_ip_address":{"title":"Kayıt IP Adresi"},"avatar":{"title":"Profil Resmi","header_title":"profil, mesajlar, işaretlenenler ve tercihler"},"title":{"title":"Başlık","none":"(hiçbiri)"},"primary_group":{"title":"Ana Grup","none":"(hiçbiri)"},"filters":{"all":"Hepsi"},"stream":{"posted_by":"Tarafından gönderildi","sent_by":"Tarafından gönderildi","private_message":"mesaj","the_topic":"konu"}},"loading":"Yükleniyor...","errors":{"prev_page":"yüklemeye çalışırken ","reasons":{"network":"Ağ Hatası","server":"Sunucu Hatası","forbidden":"Erişim Reddedildi","unknown":"Hata","not_found":"Sayfa Bulunamadı"},"desc":{"network":"Lütfen bağlantını kontrol et","network_fixed":"Geri döndü gibi gözüküyor.","server":"Hata kodu : {{status}}","forbidden":"Bunu görüntüleme iznin yok ","not_found":"Hoop, uygulama var olmayan bir URL'yi yüklemeye çalıştı.","unknown":"Bir şeyler ters gitti."},"buttons":{"back":"Geri Dön","again":"Tekrar Dene","fixed":"Sayfayı Yükle"}},"modal":{"close":"kapat"},"close":"Kapat","assets_changed_confirm":"Bu site henüz güncellendi. Son hali için sayfayı yenilemek ister misin?","logout":"Çıkış yaptın.","refresh":"Yenile","read_only_mode":{"enabled":"Bu site salt-okunur modda. Lütfen taramaya devam et, ancak yanıtlama, beğenme ve diğer eylemler şu an için devre dışı durumda. ","login_disabled":"Site salt-okunur modda iken giriş işlemi devre dışı bırakılır .","logout_disabled":"Site salt-okunur modda iken çıkış işlemi yapılamaz."},"logs_error_rate_notice":{},"learn_more":"daha fazlasını öğren...","all_time":"toplam","all_time_desc":"oluşturulan tüm konular ","year":"yıl","year_desc":"son 365 günde oluşturulan konular","month":"ay","month_desc":"son 30 günde oluşturulan konular","week":"hafta","week_desc":"son 7 günde oluşturulan konular","day":"gün","first_post":"İlk gönderi","mute":"Sessiz","unmute":"Sessiz iptali","last_post":"Gönderilen","time_read":"Okunan","time_read_recently":"%{time_read} son günlerde","time_read_tooltip":"%{time_read} toplam okuma zamanı","time_read_recently_tooltip":"%{time_read} toplam okuma zamanı (%{recent_time_read} son 60 gün içerisinde)","last_reply_lowercase":"son cevap","replies_lowercase":{"one":"cevap","other":"cevaplar"},"signup_cta":{"sign_up":"Kayıt Ol","hide_session":"Yarın bana hatırlat","hide_forever":"hayır teşekkürler","hidden_for_session":"Tamam, sana yarın soracağım. Her zaman \"Giriş Yap\" kısmını kullanarak da hesap oluşturabilirsin..","intro":"Merhaba! Tartışmanın tadını çıkarıyor gibisiniz, ancak henüz bir hesap için kaydolmadınız.","value_prop":"Bir hesap oluşturduğunuzda, ne okuduğunuzu kaydediyoruz, böylece her zaman kaldığınız yerden okumaya devam edebiliyorsunuz. Ayrıca, burada ve e-posta yoluyla, biri size yanıt verdiğinde bildirim alıyorsunuz ve sediğinizi paylaşmak için gönderileri beğenebiliyorsunuz. :Heartpulse:"},"summary":{"enabled_description":"Bu konunun özetini görüntülüyorsun: Okuyucularımızın en çok ilgisini çeken gönderiler","description":"\u003cb\u003e{{replyCount}}\u003c/b\u003e adet cevap var.","description_time":"Tahmini okuma süresi \u003cb\u003e{{readingTime}} dakika\u003c/b\u003e olan \u003cb\u003e{{replyCount}}\u003c/b\u003e cevap var.","enable":"Bu Konuyu Özetle","disable":"Tüm Gönderileri Göster"},"deleted_filter":{"enabled_description":"Bu konu silinmiş gönderiler içeriyor. Silinmiş gönderiler gizli durumda. ","disabled_description":"Bu konudaki silinen gönderiler gösteriliyor.","enable":"Silinen Gönderileri Gizle","disable":"Silinen Gönderileri Göster"},"private_message_info":{"title":"Mesaj","invite":"Başkalarını Davet Et...","edit":"Ekle ya da Kaldır ...","leave_message":"Gerçekten bu mesajdan çıkmak mı istiyorsun?","remove_allowed_user":"Bu mesajdan {{name}} isimli kullanıcıyı çıkarmak istediğine emin misin?","remove_allowed_group":"Gerçekten {{name}} isimli kullanıcıyı bu mesajdan kaldırmak istiyor musun?"},"email":"E-posta","username":"Kullanıcı Adı","last_seen":"Görülen","created":"Oluşturuldu","created_lowercase":"oluşturuldu","trust_level":"Güven Seviyesi","search_hint":"kullanıcı adı, e-posta veya IP adresi","create_account":{"disclaimer":"Kayıt olarak \u003ca href='{{privacy_link}}' target='blank'\u003eGizlilik İlkeleri'ni\u003c/a\u003e ve \u003ca href='{{tos_link}}' target='blank'\u003eHizmet Şartları'nı\u003c/a\u003e kabul etmiş olursunuz.","title":"Yeni Hesap Oluştur","failed":"Bir şeyler ters gitti. Bu e-posta ile daha önce bir kayıt oluşturulmuş olabilir. \"Şifremi unuttum\" bağlantısına tıklayarak ilerlemeni öneririz. "},"forgot_password":{"title":"Şifre Sıfırlama","action":"Şifremi unuttum","invite":"Kullanıcı adını ya da e-posta adresini gir. Sana şifre sıfırlama e-postası göndereceğiz. ","reset":"Şifre Sıfırlama ","complete_username":" \u003cb\u003e%{username}\u003c/b\u003e kullanıcı adı ile eşleşen bir hesap bulunması durumunda, kısa bir süre içerisinde şifreni nasıl sıfırlayacağını açıklayan bir e-posta alacaksın. ","complete_email":" \u003cb\u003e%{email}\u003c/b\u003e adresi ile eşleşen bir hesap bulunması durumunda, kısa bir süre içerisinde şifreni nasıl sıfırlayacağını açıklayan bir e-posta alacaksın. ","complete_username_not_found":"Hiçbir hesap kullanıcı adı \u003cb\u003e%{username}\u003c/b\u003e ile eşleşmiyor","complete_email_not_found":"Hiçbir hesap \u003cb\u003e%{email}\u003c/b\u003e adresi ile eşleşmiyor","help":"Email ulaşmadı mı? Öncelikle spam kutunuza düşmediğinden emin olun. \u003cp\u003e Hangi email adresini kullandığınızdan emin değil misiniz? Bir email adresi girin, kayıtlı olup olmadığını size bildirelim.\u003c/p\u003e\u003cp\u003e Eğer hesabınızla ilişkili email adresini kullanamıyorsanız, lütfen\u003ca href='%{basePath}/about'\u003e yardımsever ekibimizle\u003c/a\u003e iletişime geçin.\u003c/p\u003e","button_ok":"Tamam","button_help":"Yardım"},"email_login":{"link_label":"Bana \"Giriş Bağlantısı\"nı e-posta ile gönder","button_label":"e-posta ile","complete_username":"\u003cb\u003e%{username}\u003c/b\u003e kullanıcı adı bir hesap ile eşleşirse, kısa bir süre içinde giriş bağlantısına sahip bir e-posta alacaksınız.","complete_email":"\u003cb\u003e%{email}\u003c/b\u003e e-posta adresi bir hesap ile eşleşirse, kısa bir süre içinde giriş bağlantısına sahip bir e-posta alacaksınız.","complete_username_found":"\u003cb\u003e%{username}\u003c/b\u003e kullanıcı adıyla eşleşen bir hesap bulduk, kısa bir süre içerisinde giriş bağlantısına sahip bir e-posta alacaksınız.","complete_email_found":"\u003cb\u003e%{email}\u003c/b\u003e e-posta adresi ile eşleşen bir hesap bulduk, kısa bir süre içinde giriş bağlantısına sahip bir e-posta alacaksınız.","complete_username_not_found":"Hiçbir hesap kullanıcı adı \u003cb\u003e%{username}\u003c/b\u003e ile eşleşmiyor","complete_email_not_found":"%{email} Hiçbir hesap bulunamadı","confirm_title":"%{site_name} devam et","logging_in_as":"%{email} olarak giriş yapılıyor","confirm_button":"Giriş yapmayı bitir"},"login":{"title":"Giriş Yap","username":"Kullanıcı","password":"Şifre","second_factor_title":"İki Faktörlü Kimlik Doğrulama","second_factor_description":"Lütfen uygulamadan \"Kimlik Doğrulama Kodu\"nu gir:","second_factor_backup":"Bir yedekleme kodu kullanarak giriş yapın","second_factor_backup_title":"İki Faktörlü Yedekleme","second_factor_backup_description":"Lütfen yedek kodlarından birini gir:","second_factor":"Authenticator uygulamasını kullanarak giriş yapın","security_key_description":"Fiziksel güvenlik anahtarınızı hazırladığınızda, aşağıdaki Güvenlik Anahtarıyla Kimlik Doğrula düğmesine basın.","security_key_alternative":"Başka bir yol dene","security_key_authenticate":"Güvenlik Anahtarı ile Kimlik Doğrulama","security_key_not_allowed_error":"Güvenlik anahtarı kimlik doğrulama işlemi zaman aşımına uğradı veya iptal edildi.","security_key_no_matching_credential_error":"Sağlanan güvenlik anahtarında eşleşen kimlik bilgisi bulunamadı.","security_key_support_missing_error":"Geçerli cihazınız veya tarayıcınız güvenlik tuşlarının kullanımını desteklemiyor. Lütfen farklı bir yöntem kullanın.","email_placeholder":"e-posta veya kullanıcı adı","caps_lock_warning":"Caps Lock açık","error":"Bilinmeyen hata","cookies_error":"Tarayıcınızda çerezler devre dışı bırakılmış görünüyor. Giriş yapabilmek için önce çerezleri etkinleştirmeniz gerekmektedir.","rate_limit":"Tekrar giriş yapmayı denemeden önce lütfen bekle. ","blank_username":"Lütfen e-posta adresinizi ya da kullanıcı adınızı girin.","blank_username_or_password":"Lütfen e-posta adresini ya da kullanıcı adını ve şifreni gir.","reset_password":"Şifre Sıfırlama","logging_in":"Oturum açılıyor...","or":"ya da","authenticating":"Kimliğin doğrulanıyor...","awaiting_activation":"Hesabın etkinleştirme işlemini bekliyor. Başka bir etkinleştirme e-postası göndermek için \"Şifremi Unuttum\" bağlantısını kullan.","awaiting_approval":"Hesabın henüz bir görevli tarafından onaylanmadı. Onaylandığında e-posta ile bilgilendirileceksin.","requires_invite":"Üzgünüz, bu foruma sadece davetliler erişebilir.","not_activated":"Henüz oturum açamazsın. Hesabını etkinleştirmek için daha önceden \u003cb\u003e{{sentTo}}\u003c/b\u003e adresine yollanan aktivasyon e-postasındaki açıklamaları okumalısın. ","not_allowed_from_ip_address":"Bu IP adresinden giriş yapamazsın. ","admin_not_allowed_from_ip_address":"Bu IP adresinden yönetici olarak giriş yapamazsın. ","resend_activation_email":"Aktivasyon e-postasını tekrar göndermek için buraya tıkla. ","omniauth_disallow_totp":"Hesabınızın iki faktör kimlik doğrulaması etkin. Lütfen şifrenizle giriş yapın.","resend_title":"Aktivasyon e-postasını tekrar gönder","change_email":"E-posta adresini değiştir","provide_new_email":"Yeni bir adres gir. Onay e-postanı tekrar gönderelim.","submit_new_email":"E-posta adresi güncelle","sent_activation_email_again":"\u003cb\u003e{{currentEmail}}\u003c/b\u003e adresine yeni bir etkinleştirme e-postası yolladık. Bu e-postanın sana ulaşması birkaç dakika sürebilir. İstenmeyen klasörünü kontrol etmeyi unutma.","sent_activation_email_again_generic":"Başka bir aktivasyon e-postası gönderdik. Gelmesi birkaç dakika sürebilir; spam klasörünü kontrol ettiğinizden emin olun.","to_continue":"Lütfen Giriş Yap","preferences":"Tercihlerini değiştirebilmek için giriş yapman gerekiyor.","forgot":"Hesap bilgilerimi hatırlamıyorum","not_approved":"Hesabın henüz onaylanmış değil. Onaylandığında e--posta ile bilgilendirileceksin. ","google_oauth2":{"name":"Google","title":"Google ile"},"twitter":{"name":"Twitter","title":"Twitter ile"},"instagram":{"name":"Instagram","title":"Instagram ile"},"facebook":{"name":"Facebook","title":"Facebook ile"},"github":{"name":"GitHub","title":"GitHub ile"},"discord":{"name":"Discord","title":"Discord ile"},"second_factor_toggle":{"totp":"Bunun yerine bir doğrulama uygulaması kullanın","backup_code":"Bunun yerine bir yedekleme kodu kullanın"}},"invites":{"accept_title":"Davet","welcome_to":"%{site_name} hoş geldin!","invited_by":"Davet gönderen:","social_login_available":"Ayrıca bu e-posta adresini kullanan tüm sosyal ağ girişleriyle oturum açabileceksin.","your_email":"Hesap e-posta adresin \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Daveti kabul et","success":"Hesabın oluşturuldu ve şimdi giriş yaptın.","name_label":"İsim","password_label":"Şifre Belirle","optional_description":"(isteğe bağlı)"},"password_reset":{"continue":"%{site_name} devam et"},"emoji_set":{"apple_international":"Apple/Uluslararası","google":"Google","twitter":"Twitter","emoji_one":"JoyPixels (eski adıyla EmojiOne)","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Yalnızca Kategoriler","categories_with_featured_topics":"Öne çıkan konulardaki kategoriler","categories_and_latest_topics":"Kategoriler ve Son Konular","categories_and_top_topics":"Kategoriler ve Popüler Konular","categories_boxes":"Alt Kategorili Kutular","categories_boxes_with_topics":"Sunulan Konuları içeren Kutular"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Gir"},"conditional_loading_section":{"loading":"Yükleniyor..."},"category_row":{"topic_count":"{{count}} bu kategorideki konular"},"select_kit":{"default_header_text":"Seç...","no_content":"Hiçbir eşleşme bulunamadı","filter_placeholder":"Ara...","filter_placeholder_with_any":"Ara ya da yarat ...","create":"'{{content}}' Oluştur","max_content_reached":{"one":"Yalnızca {{count}} konu seçebilirsiniz","other":"Yalnızca {{count}} konuları seçebilirsiniz"},"min_content_not_reached":{"one":"En azından {{count}} konu seçiniz","other":"En azından {{count}}konuları seçiniz"},"invalid_selection_length":"Seçim en az {{count}} karakter olmalıdır."},"date_time_picker":{"from":"Kimden","to":"Kime","errors":{"to_before_from":"Bugüne kadar olan tarihten itibaren olmalıdır."}},"emoji_picker":{"filter_placeholder":"Emoji ara","smileys_\u0026_emotion":"Emojiler ve Duygular","people_\u0026_body":"İnsanlar ve Vücut","animals_\u0026_nature":"Hayvanlar ve Doğa","food_\u0026_drink":"Yiyecek ve içecek","travel_\u0026_places":"Seyahat ve Yerler","activities":"Faaliyetler","objects":"Nesneler","symbols":"Semboller","flags":"Bayraklar","recent":"Son zamanlarda kullanılmış","default_tone":"Görünüm rengi yok","light_tone":"Açık görünüm tonu","medium_light_tone":"Orta açık görünüm tonu","medium_tone":"Orta görünüm tonu","medium_dark_tone":"Orta koyu görünüm tonu","dark_tone":"Koyu görünüm tonu","default":"Özel emojiler"},"shared_drafts":{"title":"Paylaşılan taslaklar","notice":"Bu konu, yalnızca \u003cb\u003e{{category}}\u003c/b\u003e kategorisini görebilen kişiler tarafından görülebilir.","destination_category":"Hedef Kategori","publish":"Paylaşılan Taslağı Yayımla","confirm_publish":"Bu taslağı yayımlamak istediğine emin misin?","publishing":"Konu yayımlanıyor..."},"composer":{"emoji":"Emoji :)","more_emoji":"daha...","options":"Seçenekler","whisper":"fısıltı","unlist":"listelenmedi","blockquote_text":"Blok-alıntı","add_warning":"Bu resmi bir uyarıdır.","toggle_whisper":"Fısıldamayı Aç/Kapa","toggle_unlisted":"Listelenmemiş değişiklik","posting_not_on_topic":"Hangi konuyu cevaplamak istiyorsun?","saved_local_draft_tip":"yerel olarak kaydedildi","similar_topics":"Konun şunlara benziyor...","drafts_offline":"çevrimdışı taslaklar","edit_conflict":"çakışmayı düzenle","group_mentioned_limit":"\u003cb\u003eUyarı!\u003c/b\u003e \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e'den bahsettiniz, ancak bu grubun yönetici tarafından yapılandırılmış olan maksimum {{max}} kullanıcıdan bahsetme sınırını aşan daha fazla üyesi var. Kimse haberdar edilmeyecek.","group_mentioned":{"one":"{{group}} hakkında konuşarak \u003ca href='{{group_link}}'\u003e{{count}} kişiyi\u003c/a\u003e bilgilendirmek üzeresin, emin misin?","other":"{{group}} hakkında konuşarak \u003ca href='{{group_link}}'\u003e{{count}} kişiyi\u003c/a\u003e bilgilendirmek üzeresin, emin misin?"},"cannot_see_mention":{"category":"{{username}} adlı kullanıcıdan bahsettin fakat bildirim gönderilmeyecek çünkü kullanıcının bu kategoriye ulaşma izni yok. Kullanıcının bildirimi görebilmesi için onu bu gruba eklemen gerekiyor. ","private":"{{username}} adlı kullanıcıdan bahsettin fakat bildirim gönderilmeyecek çünkü kullanıcının bu kişisel mesaja ulaşma izni yok. Kişisel mesaja ulaşabilmesi için kullanıcıyı PM'ye eklemen gerekiyor. "},"duplicate_link":"Görünüşe göre \u003cb\u003e{{domain}}\u003c/b\u003e alan adına bağlanan bağlantınız \u003cb\u003e@{{username}}\u003c/b\u003e tarafından konu içine \u003ca href='{{post_url}}'\u003egönderdiği cevapta {{ago}}\u003c/a\u003e yayınlanmış görünüyor.  Tekrar yayınlamak istediğinize emin misiniz?","reference_topic_title":"RE: {{title}}","error":{"title_missing":"Başlık gerekli","title_too_short":"Başlık en az {{min}} karakter olmalı","title_too_long":"Başlık {{max}} karakterden daha uzun olamaz","post_missing":"Gönderi boş olamaz","post_length":"Gönderi en az {{min}} karakter olmalı","try_like":"{{heart}} düğmesini denediniz mi?","category_missing":"Bir kategori seçmelisin","tags_missing":"En azından {{count}} etiket seçmelisin","topic_template_not_modified":"Lütfen konu şablonunu düzenleyerek daha fazla ayrıntı ekleyin."},"save_edit":"Değişikliği Kaydet","overwrite_edit":"Üzerine Yaz","reply_original":"Asıl konu üzerinden cevap ver","reply_here":"Buradan Cevapla","reply":"Cevapla","cancel":"İptal et","create_topic":"Konu Oluştur","create_pm":"Mesaj","create_whisper":"Fısılda","create_shared_draft":"Paylaşılmış taslak oluştur","edit_shared_draft":"Paylaşılmış Taslağı Düzenle","title":"Ya da Ctrl+Enter'a bas","users_placeholder":"Kullanıcı ekle","title_placeholder":"Tek cümleyle açıklamak gerekirse bu tartışmanın konusu nedir?","title_or_link_placeholder":"Buraya bir konu gir veya bir bağlantı paylaş","edit_reason_placeholder":"neden düzenleme yapıyorsun?","topic_featured_link_placeholder":"Başlığı olan bir bağlantı gir.","remove_featured_link":"Konudan bağlantıyı kaldır.","reply_placeholder":"Buraya yaz. Biçimlendirmek için Markdown, BBCode ya da HTML kullanabilirsin. Resimleri sürükleyebilir ya da yapıştırabilirsin.","reply_placeholder_no_images":"Buraya yaz. Biçimlendirme için Markdown, BBCode ya da HTML kullan.","reply_placeholder_choose_category":"Buraya yazmadan önce bir kategori seçin.","view_new_post":"Yeni gönderini görüntüle.","saving":"Kaydediliyor","saved":"Kaydedildi!","saved_draft":"Gönderi taslağı devam ediyor. Devam etmek için dokunun.","uploading":"Yükleniyor...","show_preview":"önizlemeyi göster \u0026raquo;","hide_preview":"\u0026laquo; önizlemeyi gizle","quote_post_title":"Tüm gönderiyi göster","bold_label":"B","bold_title":"Güçlü","bold_text":"güçlü metin","italic_label":"I","italic_title":"Vurgulama","italic_text":"vurgulanan yazı","link_title":"Hyperlink ","link_description":"buraya bağlantı açıklamasını gir","link_dialog_title":"Hyperlink ekle","link_optional_text":"isteğe bağlı başlık","link_url_placeholder":"Arama konularına bir URL yapıştırın veya yazın","quote_title":"Blok-alıntı","quote_text":"Blok-alıntı","code_title":"Önceden biçimlendirilmiş yazı","code_text":"paragraf girintisi 4 boşluktan oluşan, önceden biçimlendirilen yazı","paste_code_text":"kodu buraya gir veya yapıştır","upload_title":"Yükle","upload_description":"yükleme açıklamasını buraya gir","olist_title":"Numaralandırılmış Liste","ulist_title":"Madde İşaretli Liste","list_item":"Liste öğesi","toggle_direction":"Değiştirme Yönü","help":"Düzenleme Yardım İndirimi","collapse":"yazım alanını küçült","open":"yaratıcı panelini aç","abandon":"yazım alanını kapat ve taslağı sil","enter_fullscreen":"tam ekran yaratıcıya gir","exit_fullscreen":"tam ekran yaratıcıdan çık","modal_ok":"Tamam","modal_cancel":"İptal","cant_send_pm":"Üzgünüz, %{username} kullanıcısına mesaj gönderemezsin.","yourself_confirm":{"title":"Alıcıları eklemeyi unuttun mu?","body":"Bu mesaj şu an sadece sana gönderiliyor!"},"admin_options_title":"Bu başlık için isteğe bağlı görevli ayarları","composer_actions":{"reply":"Yanıt","draft":"Taslak","edit":"Düzenle","reply_to_post":{"label":" %{postUsername} tarafından %{postNumber} gönderi cevaplandı.","desc":"İlgili gönderiyi cevapla "},"reply_as_new_topic":{"label":"Bağlantılı konu olarak yanıtla","desc":"Bu konuyla bağlantılı yeni bir konu oluştur","confirm":"Bağlantılı bir konu oluşturduğunuzda üzerine yazılacak yeni bir konu taslağınız var."},"reply_as_private_message":{"label":"Yeni Mesaj","desc":"Kişisel bir mesaj oluştur"},"reply_to_topic":{"label":"Konuyu yanıtla","desc":"Gönderiyi değil, konuyu yanıtla"},"toggle_whisper":{"label":"Fısıltıyı değiştir","desc":"Fısıltılar sadece görevliler tarafından görülebilir"},"create_topic":{"label":"Yeni Konu"},"shared_draft":{"label":"Paylaşılan Taslak","desc":"Sadece görevli tarafından görülebilecek bir konu tasarla"},"toggle_topic_bump":{"label":"Konu detaylarını değiştir","desc":"Son cevap tarihini değiştirmeden yanıtla"}},"details_title":"Özet","details_text":"Bu metin gizlenecek"},"notifications":{"tooltip":{"regular":{"one":"{{count}} görülmemiş bildirim","other":"{{count}} görülmemiş bildirim"},"message":{"one":"{{count}} okunmamış ileti","other":"{{count}} okunmamış mesaj"}},"title":"@isime yapılan bildirimler, gönderilerin ve konularına verilen cevaplar, mesajlarla vb. ilgili bildiriler","none":"Şu an için bildirimler yüklenemiyor.","empty":"Bildirim yok.","post_approved":"Gönderiniz onaylandı","reviewable_items":"inceleme gerektiren öğeler","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} ve {{count}} diğer\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} ve {{count}} diğer\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"gönderilerinizden {{count}} tanesi beğenildi","other":"gönderilerinizden {{count}} tanesi beğenildi"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e davetinizi kabul etti","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}} taşıdı","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"'{{description}}' kazandı","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eYeni Konu\u003c/span\u003e {{description}}","membership_request_accepted":"\u0026#39;{{group_name}}\u0026#39; üyeliğine kabul edildi","membership_request_consolidated":"{{count}} \u0026#39;{{group_name}}\u0026#39; için açık üyelik talepleri","group_message_summary":{"one":"{{group_name}} gelen kutunuzdaki {{count}} mesaj var","other":"{{group_name}} gelen kutunuzda {{count}} mesajları"},"popup":{"mentioned":"{{username}}, \"{{topic}}\" başlıklı konuda sizden bahsetti - {{site_title}}","group_mentioned":"{{username}} sizden bahsetti \"{{topic}}\" - {{site_title}}","quoted":"{{username}}, \"{{topic}}\" başlıklı konuda sizden alıntı yaptı - {{site_title}}","replied":"{{username}}, \"{{topic}}\" başlıklı konuda size cevap verdi - {{site_title}}","posted":"{{username}}, \"{{topic}}\" başlıklı konuya yazdı - {{site_title}}","private_message":"{{username}} \"{{topic}} konusunda \"size kişisel bir mesaj gönderdi - {{site_title}} ","linked":"{{username}}, \"{{topic}}\" başlıklı konudaki gönderinize bağlantı yaptı - {{site_title}}","watching_first_post":"{{username}} yeni bir konu oluşturdu \"{{topic}}\" - {{site_title}}","confirm_title":"Bildirimler etkin - %{site_title}","confirm_body":"Başarılı! Bildirimler etkinleştirildi.","custom":"{{username}} tarafından bildirim %{site_title}"},"titles":{"mentioned":"adı geçen","replied":"yeni cevap","quoted":"alıntı","edited":"düzenlendi","liked":"yeni beğeni","private_message":"yeni özel mesaj","invited_to_private_message":"özel mesaja davet edildi","invitee_accepted":"davet kabul edildi","posted":"yeni gönderi","moved_post":"gönderi taşındı","linked":"bağlantılı","granted_badge":"rozet verildi","invited_to_topic":"konuya davet edildi","group_mentioned":"belirtilen grup","group_message_summary":"yeni grup mesajları","watching_first_post":"yeni konu","topic_reminder":"konu hatırlatıcısı","liked_consolidated":"yeni beğeniler","post_approved":"gönderi onaylandı","membership_request_consolidated":"Yeni üyelik talepleri"}},"upload_selector":{"title":"Resim ekle","title_with_attachments":"Resim ya da dosya ekle","from_my_computer":"Kendi cihazımdan","from_the_web":"Webden","remote_tip":"resme bağlantı ata","remote_tip_with_attachments":"dosya ya da resim bağlantısı {{authorized_extensions}}","local_tip":"cihazından resimler seç","local_tip_with_attachments":"cihazından resim ya da dosya seç {{authorized_extensions}}","hint":"(düzenleyiciye \"sürükle ve bırak\" yaparak da yükleyebilirsin)","hint_for_supported_browsers":"ayrıca resimleri düzenleyiciye sürükleyip bırakabilir ya da yapıştırabilirsin","uploading":"Yükleniyor","select_file":"Dosya seç","default_image_alt_text":"resim"},"search":{"sort_by":"Sırala","relevance":"Uygunluk ","latest_post":"Son Gönderi","latest_topic":"En son konu","most_viewed":"En Çok Görüntülenen","most_liked":"En Çok Beğenilen","select_all":"Tümünü Seç","clear_all":"Tümünü Temizle","too_short":"Aradığın terim çok kısa.","result_count":{"one":"\u003cspan class='term'\u003e{{term}}\u003c/span\u003e \u003cspan\u003eiçin %{count} sonuç\u003c/span\u003e","other":"\u003cspan class='term'\u003e{{term}}\u003c/span\u003e için \u003cspan\u003e{{count}} {{plus}} sonuç\u003c/span\u003e"},"title":"konu, gönderi, kullanıcı veya kategori ara","full_page_title":"konu ya da gönderi ara","no_results":"Hiçbir sonuç bulunamadı.","no_more_results":"Başka sonuç yok.","searching":"Aranıyor...","post_format":"{{username}} tarafından #{{post_number}}","results_page":"'{{term}}' için arama sonuçları","more_results":"Daha fazla sonuç var. Lütfen arama kriterlerini daralt.","cant_find":"Aradığını bulamıyor musun?","start_new_topic":"Belki de yeni bir başlık oluşturmalısın...","or_search_google":"Ya da Google'la aramayı dene:","search_google":"Google'la aramayı dene:","search_google_button":"Google","search_google_title":"Bu sitede ara","context":{"user":"@{{username}} kullancısına ait gönderilerde ara","category":"#{{category}} kategorisini ara","tag":"# {{tag}} etiketini arayın","topic":"Bu konuyu ara","private_messages":"Mesajlarda ara"},"advanced":{"title":"Gelişmiş Arama","posted_by":{"label":"Gönderen"},"in_category":{"label":"Kategorilendirilmiş"},"in_group":{"label":"Grupta"},"with_badge":{"label":"Rozetli"},"with_tags":{"label":"Etiketlenmiş"},"filters":{"label":"Sadece şu konulara/ gönderilere dön...","title":"Sadece başlıkta eşleştirme","likes":"beğendiğim","posted":"gönderide bulunduğum","created":"ben yarattım","watching":"İzlediğim","tracking":"Takip ettiğim","private":"Mesajlarımda","bookmarks":"İşaretledim","first":"ilk gönderidir ","pinned":"sabitlenmiş","unpinned":"sabitlenmemiş","seen":"Okudum","unseen":"Okumadım","wiki":"wiki olan","images":"resim(ler)i dahil et","all_tags":"Yukarıdaki tüm etiketler"},"statuses":{"label":"Şu şekildeki konular","open":"açık","closed":"kapalı","public":"halka açık","archived":"arşivlenmiş","noreplies":"sıfır cevabı olan","single_user":"tek kullanıcı içeren"},"post":{"count":{"label":"En az gönderi sayısı"},"time":{"label":"Gönderilen","before":"önce","after":"sonra"}}}},"hamburger_menu":"Diğer bir konu ya da kategoriye git","new_item":"yeni","go_back":"geri dön","not_logged_in_user":"güncel aktivitelerin ve tercihlerin özetinin bulunduğu kullanıcı sayfası","current_user":"kendi kullanıcı sayfana git","view_all":"tümünü görüntüle","topics":{"new_messages_marker":"son ziyaret","bulk":{"select_all":"Tümünü Seç","clear_all":"Tümünü Temizle","unlist_topics":"Konuları Listeleme","relist_topics":"Konuları tekrar listele","reset_read":"Okunmuşları Sıfırla","delete":"Konuları Sil","dismiss":"Yoksay","dismiss_read":"Okumadıklarını yoksay","dismiss_button":"Yoksay...","dismiss_tooltip":"Yeni gönderileri görmezden gel ya da konuları takip etmeyi bırak","also_dismiss_topics":"Tekrar okunmamış olarak gösterilmemesi için bu konuları takip etmeyi bırak.","dismiss_new":"Yenileri Yoksay","toggle":"konuların toplu seçimini değiştir","actions":"Toplu Eylemler","change_category":"Kategori düzenle","close_topics":"Konuları Kapat","archive_topics":"Konuları Arşivle","notification_level":"Bildirimler","choose_new_category":"Konular için yeni bir kategori seç:","selected":{"one":"\u003cb\u003e{{count}}\u003c/b\u003e konu seçtiniz.","other":"\u003cb\u003e{{count}}\u003c/b\u003e konu seçtin."},"change_tags":"Etiketleri Değiştir","append_tags":"Etiketleri Ekle","choose_new_tags":"Bu konular için yeni etiketler seç:","choose_append_tags":"Konulara uygulanacak yeni etiketleri seçin:","changed_tags":"Bu konuların etiketleri değiştirildi."},"none":{"unread":"Okunmamış konun yok.","new":"Yeni konun yok.","read":"Henüz herhangi bir konu okumadın.","posted":"Henüz herhangi bir konuda gönderi yapmadın","latest":"Güncel bir konu yok. Bu üzücü.","bookmarks":"Henüz bir konu işaretlememişsin. ","category":"{{category}} konusu yok.","top":"Popüler bir konu yok.","educate":{"new":"\u003cp\u003eYeni konular burada görünecek.\u003c/p\u003e\u003cp\u003eÖntanımlı olarak son 2 gün içerisinde oluşturulmuş konular yeni olarak nitelendirilir ve \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eyeni\u003c/span\u003e ibaresiyle işaretli olarak gösterilir.\u003c/p\u003e\u003cp\u003e \u003ca href=\"%{userPrefsUrl}\"\u003etercihler\u003c/a\u003e sayfanı ziyaret ederek bunu değiştirebilirsin.\u003c/p\u003e","unread":"\u003cp\u003eOkumadığın konular burada görünecek.\u003c/p\u003e\u003cp\u003eÖntanımlı olarak, konuların okunmamış sayılması ve kaç tane\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e okunmamış mesaj olduğunun gösterilmesi için \u003c/p\u003e\u003cul\u003e\u003cli\u003eKonuyu oluşturmuş olman\u003c/li\u003e\u003cli\u003eKonuya cevap vermiş olman\u003c/li\u003e\u003cli\u003eKonuyu 4 dakikadan fazla okumuş olman\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eVeya, konuyu her konunun altında bulunan bildirim kontrol alanından Gözleniyor veya Takip Ediliyor olarak seçmen gerekir.\u003c/p\u003e\u003cp\u003e\u003ca href=\"%{userPrefsUrl}\"\u003etercihler\u003c/a\u003e sayfanı ziyaret ederek bunu değiştirebilirsin.\u003c/p\u003e"}},"bottom":{"latest":"Daha fazla güncel konu yok.","posted":"Daha fazla gönderilmiş konu yok.","read":"Daha fazla okunmuş konu yok.","new":"Daha fazla yeni konu yok.","unread":"Daha fazla okunmamış konu yok.","category":"Daha fazla {{category}} konusu yok.","top":"Daha fazla popüler konu yok.","bookmarks":"Daha fazla işaretlenmemiş konu yok."}},"topic":{"filter_to":{"one":"konuda {{count}} tane gönderi var","other":"konuda {{count}} tane gönderi var"},"create":"Yeni Konu","create_long":"Yeni bir konu oluştur","open_draft":"Taslağı Aç","private_message":"Mesaja başla","archive_message":{"help":"Mesajı arşivine taşı","title":" Arşiv"},"move_to_inbox":{"title":"Gelen kutusuna taşı","help":"Mesajı yeniden gelen kutusuna taşı"},"edit_message":{"help":"Mesajın ilk gönderisini düzenle","title":"Gönderiyi düzenle"},"defer":{"help":"okunmamış olarak işaretle","title":"Ertele"},"feature_on_profile":{"help":"Kullanıcı kartı ve profiliniz üzerinden bu konuya bir bağlantı ekleyin","title":"Profil Özelliği"},"remove_from_profile":{"warning":"Profilinizde zaten öne çıkan bir konu var. Devam ederseniz, bu konu mevcut konunun yerine öne çıkacaktır.","help":"Kullanıcı profilinizdeki bu konunun bağlantısını kaldırın","title":"Profilden Kaldır"},"list":"Konular","new":"yeni konu","unread":"okunmamış","new_topics":{"one":"{{count}} yeni konu","other":"{{count}} yeni konu"},"unread_topics":{"one":"{{count}} okunmamış konu","other":"{{count}} okunmamış konu"},"title":"Konu","invalid_access":{"title":"Bu konu özel","description":"Üzgünüz, bu konuya erişimin yok!","login_required":"Bu konuyu görüntülemek için giriş yapman gerekiyor."},"server_error":{"title":"Konu yüklenemedi.","description":"Üzgünüz, muhtemelen bir bağlantı sorunundan ötürü bu konuyu yükleyemedik. Lütfen tekrar dene. Eğer sorun devam ederse, bizimle iletişime geçmeni öneririz. "},"not_found":{"title":"Konu bulunamadı.","description":"Üzgünüz, bu konuyu bulamadık. Bu konu moderatör tarafından kaldırılmış olabilir..."},"total_unread_posts":{"one":"bu konuda {{count}} okunmamış gönderi var","other":"bu konuda {{count}} okunmamış gönderi var"},"unread_posts":{"one":"bu konuda {{count}} tane okunmamış eski gönderi var","other":"bu konuda {{count}} okunmamış eski gönderi var"},"new_posts":{"one":"bu konuda, son okumanızdan bu yana {{count}} yeni gönderi var","other":"bu konuda, son okumandan bu yana {{count}} yeni gönderi var"},"likes":{"one":"bu konuda {{count}} beğeni var","other":"bu konuda {{count}} beğeni var"},"back_to_list":"Konu listesine geri dön","options":"Konu Seçenekleri","show_links":"Bu konunun içindeki bağlantıları göster. ","toggle_information":"konu ayrıntılarını değiştir","read_more_in_category":"Daha fazlası için {{catLink}} kategorisine göz atabilir ya da {{latestLink}}yebilirsin.","read_more":"Daha fazla okumak mı istiyorsun? {{catLink}} ya da {{latestLink}}.","group_request":"Bu konuyu görebilmek için `{{name}}` grubundan üyelik talebinde bulunmalısınız.","group_join":"Bu konuyu görebilmek için {{name}} grubuna katılmalısınız.","group_request_sent":"Grup üyeliği isteğiniz gönderildi. Kabul edildiğinde bilgilendirileceksiniz.","unread_indicator":"Bu konunun son mesajını henüz hiç üye okumamış.","browse_all_categories":"Bütün kategorilere göz at","view_latest_topics":"Son konuları görüntüle","suggest_create_topic":"Konu oluşturmaya ne dersin?","jump_reply_up":"Önceki cevaba geç","jump_reply_down":"Sonraki cevaba geç","deleted":"Konu silindi ","topic_status_update":{"title":"Konu Zamanlayıcısı","save":"Zamanlayıcıyı Ayarla","num_of_hours":"Saat:","remove":"Zamanlayıcıyı Kaldır","publish_to":"Şuraya Yayınla:","when":"Ne zaman:","public_timer_types":"Konu Zamanlayıcıları","private_timer_types":"Kullanıcı Konu Zamanlayıcıları","time_frame_required":"Bir zaman dilimi seç"},"auto_update_input":{"none":"Zaman aralığı seç","later_today":"Bugün ilerleyen saatlerde","tomorrow":"Yarın","later_this_week":"Bu hafta içinde","this_weekend":"Bu hafta sonu","next_week":"Gelecek hafta","two_weeks":"İki Hafta","next_month":"Gelecek ay","two_months":"İki ay","three_months":"Üç Ay","four_months":"Dört ay","six_months":"Altı Ay","one_year":"Bir Yıl","forever":"Sonsuza dek","pick_date_and_time":"Tarih ve saat seç","set_based_on_last_post":"Son gönderiye göre kapat"},"publish_to_category":{"title":"Program yayını"},"temp_open":{"title":"Geçici Olarak Aç"},"auto_reopen":{"title":"Konuyu Otomatik Aç"},"temp_close":{"title":"Geçici Olarak Kapat"},"auto_close":{"title":"Konuyu Otomatik Kapat","label":"Konunun otomatik kapatılacağı saatler:","error":"Lütfen geçerli bir değer gir.","based_on_last_post":"Konudaki son gönderi en az bu kadar eski olmadıkça kapatma."},"auto_delete":{"title":"Konuyu Otomatik Sil"},"auto_bump":{"title":"Konuyu Otomatik Patlat"},"reminder":{"title":"Bana hatırlat"},"status_update_notice":{"auto_open":"Bu konu %{timeLeft} otomatik olarak açılacak.","auto_close":"Bu konu %{timeLeft} otomatik olarak kapanacak.","auto_publish_to_category":"Bu konu %{timeLeft} \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e kategorisinde yayınlanacak.","auto_close_based_on_last_post":"Bu konu son cevaptan %{duration} sonra kapanacak.","auto_delete":"Bu konu otomatik olarak silinecek %{timeLeft}.","auto_bump":"Bu konu otomatik olarak patlayacak%{timeLeft}.","auto_reminder":"%{timeLeft} Bu konu hakkında hatırlatılacaksınız"},"auto_close_title":"Otomatik Kapatma Ayarları","auto_close_immediate":{"one":"Konudaki son gönderi zaten %{count} saat eski, bu yüzden konu hemen kapatılacak.","other":"Konudaki son gönderi zaten %{count} saat önce gönderilmiş. Bu yüzden konu hemen kapatılacak."},"timeline":{"back":"Geri","back_description":"Okunmamış son gönderine dön","replies_short":"%{current} / %{total}"},"progress":{"title":"konu gidişatı","go_top":"en üst","go_bottom":"en alt","go":"git","jump_bottom":"son gönderiye geç","jump_prompt":"geç","jump_prompt_of":" %{count} gönderinin","jump_prompt_long":"Atla...","jump_bottom_with_number":"%{post_number} numaralı gönderiye geç","jump_prompt_to_date":"şimdiye kadar","jump_prompt_or":"ya da","total":"toplam gönderiler","current":"şu anki gönderi"},"notifications":{"title":"bu konu hakkında bildirim sıklığını değiştir","reasons":{"mailing_list_mode":"Duyuru listesi modunu etkinleştirdin. Bu sebeple bu konuya gelen cevaplarla ilgili bildirimleri e-posta yoluyla alacaksın. ","3_10":"Bu konuyla ilgili bir etiketi izlediğin için bildirimleri alacaksın.","3_6":"Bu kategoriyi izlediğin için bildirimleri alacaksın.","3_5":"Bu konuyu otomatik olarak izlemeye başladığın için bildirimleri alacaksın.","3_2":"Bu konuyu izlediğin için bildirimleri alacaksın.","3_1":"Bu konuyu sen oluşturduğun için bildirimleri alacaksın.","3":"Bu konuyu izlediğin için bildirimleri alacaksın.","2_8":"Bu kategoriyi takip ettiğiniz için yeni cevapların sayısını göreceksiniz.","2_4":"Bu konuyu yanıtladığınız için yeni cevapların sayısını göreceksiniz.","2_2":"Bu konuyu takip ettiğiniz için yeni cevapların sayısını göreceksiniz.","2":"Yeni cevapların sayısını göreceksiniz çünkü \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003ebu konuyu okudunuz\u003c/a\u003e.","1_2":"Birisi @isminden bahsederse ya da sana cevap verirse bildirim alacaksın.","1":"Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın.","0_7":"Bu kategoriye ait tüm bildirimleri yok sayıyorsun.","0_2":"Bu konuya ait tüm bildirimleri yok sayıyorsun.","0":"Bu konuya ait tüm bildirimleri yok sayıyorsun."},"watching_pm":{"title":"İzleniyor","description":"Bu mesajdaki her yeni gönderi için bir bildirim alacaksın ve yeni cevap sayısı gösterilecek."},"watching":{"title":"İzleniyor","description":"Bu konudaki her yeni gönderi için bildirim alacaksın ve yeni cevap sayısı gösterilecek."},"tracking_pm":{"title":"Takip Ediliyor","description":"Bu mesaj için yeni cevapların sayısı gösterilecek. Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın."},"tracking":{"title":"Takip Ediliyor","description":"Bu konu için yeni cevap sayısı gösterilecek. Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın."},"regular":{"title":"Normal","description":"Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın."},"regular_pm":{"title":"Normal","description":"Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın."},"muted_pm":{"title":"Sessiz","description":"Bu mesaj ile ilgili hiçbir bildirim almayacaksın."},"muted":{"title":"Sessiz","description":"Bu konu en son gönderilerde gözükmeyecek ve hakkında hiçbir bildirim almayacaksın."}},"actions":{"title":"Eylemler","recover":"Konuyu Geri Getir","delete":"Konuyu Sil","open":"Konuyu Aç","close":"Konuyu Kapat","multi_select":"Gönderileri Seç...","timed_update":"Konu Zamanlayıcısını Ayarla","pin":"Konuyu En Yukarıda Sabitle...","unpin":"Konuyu En Yukarıda Sabitleme...","unarchive":"Konuyu Arşivleme","archive":"Konuyu Arşivle","invisible":"Listelenmemiş Yap","visible":"Listelenmiş Yap","reset_read":"Görüntüleme Verilerini Sıfırla","make_public":"Herkese Açık Konu Yap","make_private":"Kişisel Mesaj Yap","reset_bump_date":"Patlama Tarihini Sıfırla"},"feature":{"pin":"Konuyu En Yukarıda Sabitle","unpin":"Konuyu En Yukarıda Sabitleme","pin_globally":"Konuyu Her Yerde En Yukarıda Sabitle","make_banner":"Pankart Konusu","remove_banner":"Pankart Konusunu Kaldır"},"reply":{"title":"Cevapla","help":"bu konuya bir cevap oluşturmaya başla"},"clear_pin":{"title":"\"En Yukarıda Sabitleme\"yi temizle","help":"Bu konunun en yukarıda sabitlenmesi iptal edilsin ki artık konu listenin en üstünde gözükmesin"},"share":{"title":"Paylaş","extended_title":"Bağlantı paylaş","help":"bu konunun bağlantısını paylaş"},"print":{"title":"Yazdır","help":"Bu konunun yazıcı dostu olan sürümünü aç"},"flag_topic":{"title":"Bayrakla işaretle","help":"bu gönderiyi kontrol edilmesi için özel olarak bayrakla işaretle ya da bununla ilgili özel bir bildirim gönder","success_message":"Bu konuyu başarıyla bayrakla işaretledin"},"make_public":{"title":"Herkese Açık Konuya Dönüştür","choose_category":"Lütfen genel konu için bir kategori seçin:"},"feature_topic":{"title":"Bu konuyu ön plana çıkar","pin":"Şu zamana kadar bu konunun {{categoryLink}} kategorisinin başında görünmesini sağla","confirm_pin":"Zaten en yukarıda sabitlenmiş {{count}} konun var. Çok fazla konuyu en yukarıda sabitlemek yeni ve anonim kullanıcılarda sorun yaratabilir. Bu kategoride bir konuyu en yukarıda sabitlemek istediğine emin misin?","unpin":"Bu konuyu {{categoryLink}} kategorisinin en üstünden kaldır.","unpin_until":"Bu konuyu {{categoryLink}} kategorisinin başından kaldır ya da şu zamana kadar bekle: \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Kullanıcılar kendileri için konunun en yukarıda sabitlenmesini kaldırabilir.","pin_validation":"Bu konuyu en yukarıda sabitlemek için bir tarih gerekli.","not_pinned":" {{categoryLink}} kategorisinde en yukarıda sabitlenen herhangi bir konu yok.","already_pinned":{"one":"Şu an {{categoryLink}} kategorisinde başa tutturulan konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Şu an {{categoryLink}} kategorisinde en yukarıda sabitlenen konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"pin_globally":"Şu zamana kadar bu konunun bütün konu listelerinin başında yer almasını sağla","confirm_pin_globally":"Zaten her yerde en yukarıda sabitlenen {{count}} konun var. Çok fazla konuyu en yukarıda sabitlemek yeni ve anonim kullanıcılarda sorun yaratabilir. Bir konuyu her yerde en yukarıda sabitlemek istediğine emin misin?","unpin_globally":"Bu konuyu tüm konu listelerinin en üstünden kaldır.","unpin_globally_until":"Bu konuyu bütün konu listelerinin başından kaldır ya da şu zamana kadar bekle: \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Kullanıcılar kendileri için konunun en yukarıda sabitlenmesini kaldırabilir.","not_pinned_globally":"Her yerde en yukarıda sabitlenen herhangi bir konu yok.","already_pinned_globally":{"one":"Şu an her yerde başa tutturulan konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e.","other":"Şu an her yerde en yukarıda sabitlenen konular: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e."},"make_banner":"Bu konuyu tüm sayfaların en üstünde görünecek şekilde pankart yap. ","remove_banner":"Tüm sayfaların en üstünde görünen pankartı kaldır.","banner_note":"Kullanıcılar bu pankartı kapatarak yoksayabilirler. Herhangi bir zamanda sadece bir konu pankart yapılabilir. ","no_banner_exists":"Pankart konusu yok.","banner_exists":"Şu an bir pankart konusu \u003cstrong class='badge badge-notification unread'\u003evar\u003c/strong\u003e."},"inviting":"Davet Ediliyor...","automatically_add_to_groups":"Bu davet aynı zamanda bu gruplara erişim izni sağlar:","invite_private":{"title":"Mesaja Davet Et","email_or_username":"Davet edilenin e-postası ya da kullanıcı adı","email_or_username_placeholder":"e-posta ya da kullanıcı adı","action":"Davet","success":"Kullanıcıyı bu mesaja davet ettik.","success_group":"Grubu bu mesaja katılması için davet ettik.","error":"Üzgünüz, kullanıcı davet edilirken bir hata oluştu.","group_name":"grup adı"},"controls":"Konu Kontrolleri","invite_reply":{"title":"Davet","username_placeholder":"kullanıcı adı","action":"Davet Gönder","help":"e-posta veya bildiri aracılığıyla başkalarını bu konuya davet et","to_forum":"Arkadaşına, giriş yapması gerekmeden, bağlantıya tıklayarak katılabilmesi için kısa bir e-posta göndereceğiz. ","sso_enabled":"Bu konuya davet etmek istediğin kişinin kullanıcı adını gir.","to_topic_blank":"Bu konuya davet etmek istediğin kişinin kullanıcı adını veya e-posta adresini gir.","to_topic_email":"Bir e-posta adresi girdin. Arkadaşının bu konuya hemen cevap verebilmesini sağlayacak bir davetiyeyi e-posta ile göndereceğiz. ","to_topic_username":"Bir kullanıcı adı girdin. Kullanıcıya, bu konuya davet bağlantısı içeren bir bildirim göndereceğiz.","to_username":"Davet etmek istediğin kişinin kullanıcı adını gir. Kullanıcıya, bu konuya davet bağlantısı içeren bir bildirim göndereceğiz.","email_placeholder":"isim@örnek.com","success_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e kullanıcısına davet e-postalandı. Davet kabul edildiğinde sana bir bildirim göndereceğiz. Davetlerini takip etmek için kullanıcı sayfandaki davetler sekmesine göz atmalısın. ","success_username":"Kullanıcıyı bu konuya katılması için davet ettik.","error":"Üzgünüz, kullanıcıyı davet edemedik. Zaten davet edilmiş olabilir mi? (Davetler oran sınırlarına tabiidir.)","success_existing_email":"\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e e-posta adresine sahip bir kullanıcı zaten var. Bu kullanıcıyı bu konuya katılmaya davet ettik."},"login_reply":"Cevaplamak için giriş yap","filters":{"n_posts":{"one":"{{count}} gönderi","other":"{{count}} gönderi"},"cancel":"Filtreyi kaldır"},"move_to":{"title":"Taşındı","action":"taşındı","error":"Gönderiler taşınırken bir hata oluştu."},"split_topic":{"title":"Yeni Konuya Geç","action":"yeni konuya geç","topic_name":"Yeni Konu Başlığı","radio_label":"Yeni Konu","error":"Gönderileri yeni konuya taşırken bir hata oluştu.","instructions":{"one":"Yeni bir konu oluşturmak ve bu konuyu seçtiğiniz \u003cb\u003e{{count}}\u003c/b\u003e gönderi ile doldurmak üzeresiniz.","other":"Yeni bir konu oluşturmak ve bu konuyu seçtiğin \u003cb\u003e{{count}}\u003c/b\u003e gönderi ile doldurmak üzeresin. "}},"merge_topic":{"title":"Var Olan Bir Konuya Taşı","action":"var olan bir konuya taşı","error":"Gönderileri konuya taşırken bir hata oluştu.","radio_label":"Mevcut Konu","instructions":{"one":"Lütfen bu \u003cb\u003e{{count}}\u003c/b\u003e gönderiyi taşımak istediğiniz konuyu seçin. ","other":"Lütfen bu \u003cb\u003e{{count}}\u003c/b\u003e gönderiyi taşımak istediğin konuyu seç. "}},"move_to_new_message":{"title":"Yeni Mesajlara Taşı","action":"yeni mesaja taşı","message_title":"Yeni Mesaj Başlığı","radio_label":"Yeni Mesaj","participants":"Katılımcılar","instructions":{"one":"Yeni bir ileti oluşturmak ve  seçtiğin gönderiyle onu doldurmak üzeresin","other":"Yeni bir ileti oluşturmak ve \u003cb\u003e{{count}}\u003c/b\u003e sayıda gönderiyle onu doldurmak üzeresin"}},"move_to_existing_message":{"title":"Mevcut Mesaja Taşı","action":"mevcut mesaja taşı","radio_label":"Mevcut Mesaj","participants":"Katılımcılar","instructions":{"one":"Lütfen bu postayı taşımak istediğiniz iletiyi seçin.","other":"Lütfen bu \u003cb\u003e{{count}}\u003c/b\u003egönderiyi taşımak istediğiniz iletiyi seçin."}},"merge_posts":{"title":"Seçili Gönderileri Birleştir","action":"seçili gönderileri birleştir","error":"Seçili gönderileri birleştirirken bir hata oluştu."},"change_owner":{"title":"Sahibini Değiştir","action":"sahipliği değiştir","error":"Gönderilerin sahipliği değiştirilirken bir hata oluştu.","placeholder":"yeni sahibin kullanıcı adı","instructions":{"one":"Lütfen \u003cb\u003e@ {{old_user}}\u003c/b\u003e tarafından yayın için yeni bir sahibi seçin","other":"Lütfen \u003cb\u003e@{{old_user}}\u003c/b\u003e kullanıcısına ait {{count}} gönderiler için yeni bir sahip seçin."}},"change_timestamp":{"title":"Tarih Bilgisini Değiştir","action":"tarih bilgisini değiştir","invalid_timestamp":"Tarih bilgisi gelecekte olamaz.","error":"Konunun tarih bilgisi değişirken bir hata oluştu.","instructions":"Lütfen konunun yeni tarih bilgisini seç. Konudaki gönderiler aynı zaman farkına sahip olması için güncellenecek.."},"multi_select":{"select":"seç","selected":"({{count}}) seçildi","select_post":{"label":"seç","title":"Seçime gönderi ekle"},"selected_post":{"label":"seçilmiş","title":"Seçimi yayından kaldırmak için tıkla"},"select_replies":{"label":"seçim +cevaplar","title":"Gönderiyi ve tüm cevaplarını seçime ekle"},"select_below":{"label":"seç +alt","title":"Seçimin ardından gönderi ekle"},"delete":"seçilenleri sil","cancel":"seçimi iptal et","select_all":"tümünü seç","deselect_all":"tüm seçimi kaldır","description":{"one":"\u003cb\u003e{{count}}\u003c/b\u003e gönderi seçtiniz.","other":"\u003cb\u003e{{count}}\u003c/b\u003e gönderi seçtin."}},"deleted_by_author":{"one":"(yazarı tarafından geri alınan konu, bildirilmiş hale gelmezse %{count} saat içinde otomatik olarak silinecek.)","other":"(yazarı tarafından geri alınan konu, bildirilmiş hale gelmezse %{count} saat içinde otomatik olarak silinecek.)"}},"post":{"quote_reply":"Alıntı","edit_reason":"Neden: ","post_number":"gönderi {{number}}","ignored":"Yoksayılan içerik","wiki_last_edited_on":"son düzenlenmiş wiki","last_edited_on":"son düzenlenmiş gönderi","reply_as_new_topic":"Bağlantılı Konu Olarak Cevapla","reply_as_new_private_message":"Aynı alıcıyı yeni bir mesajla cevapla","continue_discussion":"{{postLink}} Gönderisinden tartışılmaya devam ediliyor:","follow_quote":"alıntılanan gönderiye git","show_full":"Gönderinin Tamamını Göster","show_hidden":"Yok sayılan içeriği görüntüleyin.","deleted_by_author":{"one":"(yazarı tarafından geri alınan gönderi, bildirilmediği takdirde %{count} saat içinde otomatik olarak silinecek.)","other":"(yazarı tarafından geri alınan gönderi, bildirilmediği takdirde %{count} saat içinde otomatik olarak silinecek.)"},"collapse":"daralt","expand_collapse":"genişlet/daralt","locked":"personel bu yayının düzenlenmesini kilitledi","gap":{"one":"gizlenen {{count}} yorumu gör","other":"gizlenen {{count}} yorumu gör"},"notice":{"new_user":"{{user}} ilk kez gönderi oluşturdu - haydi ona topluluğumuza hoşgeldin diyelim","returning_user":"{{user}} i göreli bir süre oldu — son gönderileri {{time}} önce"},"unread":"Gönderi okunmamış","has_replies":{"one":"{{count}} Cevap","other":"{{count}} Cevap"},"has_likes_title":{"one":"{{count}} kişi bu gönderiyi beğendi","other":"{{count}} kişi bu gönderiyi beğendi"},"has_likes_title_only_you":"bu gönderiyi beğendin","has_likes_title_you":{"one":"siz ve {{count}} diğer kişi bu gönderiyi beğendi","other":"sen ve {{count}} kişi bu gönderiyi beğendi"},"errors":{"create":"Üzgünüz, gönderin oluşturulurken bir hata oluştu. Lütfen tekrar dene.","edit":"Üzgünüz, gönderin düzenlenirken bir hata oluştu. Lütfen tekrar dene. ","upload":"Üzgünüz, dosya yüklenirken bir hata oluştu. Lütfen tekrar dene.","file_too_large":"Üzgünüz, bu dosya çok büyük (en fazla {{max_size_kb}}kb). Neden paylaşımını bir bulut sağlayıcısına yükleyip bağlantısını paylaşmıyorsun ?","too_many_uploads":"Üzgünüz, aynı anda sadece tek dosya yüklenebilir.","too_many_dragged_and_dropped_files":"Üzgünüz, tek seferde sadece {{max}} dosya yükleyebilirsin.","upload_not_authorized":"Üzgünüz, yüklemeye çalıştığın dosya izinli değil (izinli uzantılar : {{izinli uzantılar}}).","image_upload_not_allowed_for_new_user":"Üzgünüz, yeni kullanıcılar resim yükleyemez.","attachment_upload_not_allowed_for_new_user":"Üzgünüz, yeni kullanıcılar dosya yükleyemez.","attachment_download_requires_login":"Üzgünüz, eklentileri indirebilmek için giriş yapman gerekiyor."},"abandon_edit":{"confirm":"Değişikliklerinizi silmek istediğinizden emin misiniz?","no_value":"Hayır, kalsın","no_save_draft":"Hayır, taslağı kaydet","yes_value":"Evet, düzenlemeyi iptal et"},"abandon":{"confirm":"Gönderinden vazgeçtiğine emin misin?","no_value":"Hayır, kalsın","no_save_draft":"Hayır, taslağı kaydet","yes_value":"Evet, vazgeç"},"via_email":"bu gönderi e-posta ile iletildi","via_auto_generated_email":"bu gönderi otomatik bir e-posta yoluyla gönderildi","whisper":"bu gönderi yöneticiler için özel bir fısıltıdır","wiki":{"about":"bu gönderi bir wiki'dir"},"archetypes":{"save":"Seçenekleri kaydet"},"few_likes_left":"Beğendiğin için teşekkürler! Bugün için sadece birkaç beğenin kaldı. ","controls":{"reply":"bu gönderiye bir cevap oluşturmaya başla","like":"bu gönderiyi beğen","has_liked":"bu gönderiyi beğendin","read_indicator":"bu yayını okuyan üyeler","undo_like":"beğenmekten vazgeç","edit":"bu gönderiyi düzenle","edit_action":"Düzenle","edit_anonymous":"Üzgünüz, ama bu gönderiyi düzenleyebilmek için giriş yapmalısın. ","flag":"bu gönderinin kontrol edilmesi için özel olarak bildir ya da bununla ilgili özel bir bildirim gönder","delete":"bu gönderiyi sil","undelete":"bu gönderinin silinmesini geri al","share":"bu gönderinin bağlantısını paylaş","more":"Daha fazla","delete_replies":{"confirm":"Bu gönderideki yanıtları da silmek istiyor musun?","direct_replies":{"one":"Evet, ve %{count} doğrudan cevap","other":"Evet ve {{count}} doğrudan yanıtlar"},"all_replies":{"one":"Evet, ve %{count} yanıt","other":"Evet, ve tüm {{count}} yanıtlar"},"just_the_post":"Hayır, sadece bu gönderi"},"admin":"gönderi yönetici eylemleri","wiki":"Wiki Yap","unwiki":"Wiki'yi Kaldır","convert_to_moderator":"Görevli Rengi Ekle","revert_to_regular":"Görevli Rengini Kaldır","rebake":"HTML'i Yeniden Yapılandır","unhide":"Gizleme","change_owner":"Sahipliğini Değiştir","grant_badge":"Hibe Kartı","lock_post":"Gönderiyi kilitle","lock_post_description":"Yayımdan bu pankartı engelle","unlock_post":"Gönderiyi Kilitleme","unlock_post_description":"Yayımda bu pankarta izin ver","delete_topic_disallowed_modal":"Bu konuyu silme iznin yok. Gerçekten silinmesini istiyorsan, nedenini de belirterek moderatöre bir bilgilendirme gönder.","delete_topic_disallowed":"bu konuyu silme iznin yok","delete_topic":"konuyu sil","add_post_notice":"Personel Bildirimi Ekle","remove_post_notice":"Personel Bilgisini Kaldır","remove_timer":"zamanlayıcıyı kaldır"},"actions":{"flag":"Bayrakla işaretle","defer_flags":{"one":"Bildirimi yoksay","other":"Bildirimleri yoksay"},"undo":{"off_topic":"Bayrakla işaretlemeyi geri al","spam":"Bayrakla işaretlemeyi geri al","inappropriate":"Bayrakla işaretlemeyi geri al","bookmark":"İşaretlemeyi geri al","like":"Beğenini geri al"},"people":{"off_topic":"Bayrakla \"konu dışı\" olarak işaretlendi","spam":"Bayrakla \"istenmeyen e-posta\" olarak işaretlendi","inappropriate":"Bayrakla \"uygunsuz\" olarak işaretlendi","notify_moderators":"bilgilendirilen moderatörler ","notify_user":"mesaj gönderdi","bookmark":"bunu işaretledi","like":{"one":"bu beğenildi","other":"bunlar beğenildi"},"read":{"one":"bunu oku","other":" bunları oku"},"like_capped":{"one":"ve {{count}} diğer kişi bunu beğendi","other":"ve {{count}} diğerleri bunu beğendi"},"read_capped":{"one":"ve {{count}} tanesini daha okuyun","other":"ve {{count}}tanesini daha okuyun"}},"by_you":{"off_topic":"Bunu bayrakla \"konu dışı\" olarak işaretledin","spam":"Bunu bayrakla \"istenmeyen e-posta\" olarak işaretledin","inappropriate":"Bunu bayrakla \"uygunsuz\" olarak işaretledin","notify_moderators":"Bunu moderatörün denetlemesi için bayrakla işaretledin","notify_user":"Bu kullanıcıya mesaj gönderdin","bookmark":"Bu gönderiyi işaretledin","like":"Bunu beğendin"}},"delete":{"confirm":{"one":"Bu gönderiyi silmek istediğinize emin misiniz?","other":"{{count}} tane gönderiyi silmek istediğinize emin misiniz?"}},"merge":{"confirm":{"one":"Bu yayınları birleştirmek istediğinize emin misiniz?","other":"{{count}} gönderiyi birleştirmek istediğinizden emin misiniz?"}},"revisions":{"controls":{"first":"İlk revizyon","previous":"Önceki revizyon","next":"Sonraki revizyon","last":"Son revizyon","hide":"Düzenlemeyi gizle","show":"Düzenlemeyi göster","revert":"Bu uyarlamaya geri dön","edit_wiki":"Wiki'yi düzenle","edit_post":"Gönderiyi düzenle","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e{{icon}}\u003cstrong\u003e{{current}}\u003c/strong\u003e/{{total}}"},"displays":{"inline":{"title":"Hazırlanan cevabı ekleme ve çıkarmalarla birlikte göster","button":"HTML"},"side_by_side":{"title":"Hazırlanan cevabın farklarını yan yana göster","button":"HTML"},"side_by_side_markdown":{"title":"Hazırlanan cevabın ham kaynaklarını yan yana göster","button":"Ham"}}},"raw_email":{"displays":{"raw":{"title":"E-postanın ham halini göster","button":"Ham"},"text_part":{"title":"E-postanın metin bölümünü göster","button":"Metin"},"html_part":{"title":"E-postanın html bölümünü göster","button":"HTML"}}},"bookmarks":{"create":"Yer işareti oluştur","created":"Oluşturuldu","name":"İsim"}},"category":{"can":"yapabilir\u0026hellip;","none":"(kategori yok)","all":"Tüm kategoriler","choose":"kategori\u0026yardım;","edit":"Düzenle","edit_dialog_title":"Düzenle: %{categoryName}","view":"Bu Kategorideki Konuları Görüntüle","general":"Genel","settings":"Ayarlar","topic_template":"Konu Şablonu","tags":"Etiketler","tags_allowed_tags":"Bu etiketleri bu kategoriyle sınırla:","tags_allowed_tag_groups":"Bu etiket gruplarını bu kategoriyle sınırla:","tags_placeholder":"(Seçmeli) izin verilen etiketlerin listesi","tags_tab_description":"Yukarıda belirtilen etiketler ve etiket grupları yalnızca bu kategoride ve bunları belirten diğer kategorilerde bulunur. Diğer kategorilerde kullanılamazlar.","tag_groups_placeholder":"(Seçmeli) izin verilen etiket gruplarının listesi","manage_tag_groups_link":"Etiket gruplarını burada yönetin.","allow_global_tags_label":"Diğer etiketlere de izin ver","tag_group_selector_placeholder":"(Opsiyonel) Etiket grubu","required_tag_group_description":"Bir etiket grubundaki etiketleresahip olmak için için yeni konular gerekiyor:","min_tags_from_required_group_label":"Etiketler:","required_tag_group_label":"Etiket grubu:","topic_featured_link_allowed":"Bu kategoride özellikli bağlantılara izin ver","delete":"Kategoriyi Sil","create":"Yeni Kategori","create_long":"Yeni bir kategori oluştur","save":"Kategoriyi Kaydet","slug":"Alakasız Kategoriler","slug_placeholder":"(İsteğe bağlı) bağlantı için çizgi ile ayrılmış kelimeler","creation_error":"Kategori oluşturulurken bir hata oldu ","save_error":"Kategori kaydedilirken hata oluştu.","name":"Kategori Adı","description":"Açıklama","topic":"kategori konusu","logo":"Kategori Logo Resmi","background_image":"Kategori Arka Plan Resmi ","badge_colors":"Rozet renkleri","background_color":"Arka plan rengi","foreground_color":"Ön plan rengi","name_placeholder":"En fazla bir ya da iki kelime","color_placeholder":"Herhangi bir web rengi","delete_confirm":"Bu kategoriyi silmek istediğine emin misin?","delete_error":"Kategori silinirken bir hata oluştu.","list":"Kategorileri Listele","no_description":"Lütfen bu kategori için bir açıklama ekle.","change_in_category_topic":"Açıklamayı Düzenle","already_used":"Bu renk başka bir kategori için kullanıldı","security":"Güvenlik","special_warning":"Uyarı: Bu kategori önceden ayarlanmış bir kategoridir ve güvenlik ayarları değiştirilemez. Eğer bu kategoriyi kullanmak istemiyorsan, başka bir amaçla kullanmak yerine sil.","uncategorized_security_warning":"Bu kategori özeldir. Kategorisi olmayan konular için tutma alanı olarak tasarlanmıştır; güvenlik ayarlarına sahip olamaz.","uncategorized_general_warning":"Bu kategori özeldir. Kategori seçilmeyen yeni konular için varsayılan kategori olarak kullanılır. Bu davranışı önlemek ve kategori seçimini zorlamak istiyorsanız, \u003ca href=\"%{settingLink}\"\u003elütfen buradaki ayarı\u003c/a\u003e devre dışı bırakın. Adı veya açıklamayı değiştirmek istiyorsanız, \u003ca href=\"%{customizeLink}\"\u003eÖzelleştir / Metin İçeriği\u003c/a\u003e'ne gidin.","pending_permission_change_alert":"Bu %{group} henüz kategoriye eklenmedi; eklemek için bu butona tıklayın. ","images":"Resimler","email_in":"Kişiselleşmiş gelen e-posta adresi:","email_in_allow_strangers":"Hesabı olmayan, isimsiz kullanıcılardan e-posta kabul et","email_in_disabled":"E-posta üzerinden yeni konu oluşturma özelliği Site Ayarları'nda devre dışı bırakılmış. E-posta üzerinden yeni konu oluşturma özelliğini etkinleştirmek için,","email_in_disabled_click":"\"e-posta\" ayarını etkinleştir","mailinglist_mirror":"Kategori bir e-posta listesini yansıtır","show_subcategory_list":"Bu kategorideki alt kategori listesini üst başlıklarda göster","num_featured_topics":"Kategoriler sayfasında gösterilen konu sayısı:","subcategory_num_featured_topics":"Üst kategori sayfasındaki öne çıkan konuların sayısı:","all_topics_wiki":"Yeni konuları wiki'nin varsayılanı yap","subcategory_list_style":"Alt Kategori Liste Biçimi:","sort_order":"Konu Listesini Şuna Göre Sırala:","default_view":"Varsayılan Konu Listesi:","default_top_period":"Varsayılan Üst Periyot:","allow_badges_label":"Bu kategoride rozetle ödüllendirilmesine izin ver","edit_permissions":"İzinleri Düzenle","reviewable_by_group":"Personele ek olarak, bu kategorideki gönderiler ve bayraklar aşağıdakiler tarafından da incelenebilir:","review_group_name":"grup adı","require_topic_approval":"Tüm yeni konular moderatör onayını gerektirir","require_reply_approval":"Tüm yeni cevaplar moderatör onayı gerektirir","this_year":"bu yıl","position":"Kategoriler sayfasındaki pozisyon:","default_position":"Varsayılan Pozisyon","position_disabled":"Kategoriler etkinlik sıralarına göre görünecek. Listelerdeki kategorilerin sıralamalarını kontrol edebilmek için,","position_disabled_click":"\"Sabit kategori pozisyonları\" ayarını etkinleştir.","minimum_required_tags":"Bir konu için gereken minimum etiket sayısı:","parent":"Üst Kategori","num_auto_bump_daily":"Günlük otomatik olarak açılan açık konuların sayısı:","navigate_to_first_post_after_read":"Konular okunduktan sonra ilk gönderiye dön","notifications":{"watching":{"title":"İzleniyor","description":"Bu kategorilerdeki tüm konuları otomatik olarak izleyeceksin. Tüm konulardaki her yeni gönderiden haberdar olacak ve yeni cevapların sayısını göreceksin. "},"watching_first_post":{"title":"İlk Gönderi İzleme","description":"Bu kategorideki yeni konular size bildirilecektir ancak konulara cevap verilmeyecektir."},"tracking":{"title":"Takip Ediliyor","description":"Bu kategorilerdeki tüm yeni konuları otomatik olarak takip edeceksin. Birisi @isminden bahsederse veya gönderine cevap verirse bildirim alacak, ayrıca yeni cevapların sayısını da göreceksin. "},"regular":{"title":"Normal","description":"Birisi @isminden bahsederse veya sana cevap verirse bildirim alacaksın."},"muted":{"title":"Sessiz","description":"Bu kategorilerdeki yeni konular hakkında herhangi bir bildiri almayacaksın ve en son gönderiler de gözükmeyecek. "}},"search_priority":{"label":"Arama Önceliği","options":{"normal":"Normal","ignore":"Yoksay","very_low":"Çok düşük","low":"Düşük","high":"Yüksek","very_high":"Çok yüksek"}},"sort_options":{"default":"varsayılan","likes":"Beğeniler","op_likes":"Orijinal Gönderi Beğenileri","views":"Görüntülenenler","posts":"Gönderiler","activity":"Aktivite","posters":"Posterler","category":"Kategori","created":"Oluşturulan","votes":"Oylar"},"sort_ascending":"Artan","sort_descending":"Azalan","subcategory_list_styles":{"rows":"Satırlar","rows_with_featured_topics":"Öne çıkan konulardaki satırlar","boxes":"Kutular","boxes_with_featured_topics":"Öne çıkan konuların kutusu"},"settings_sections":{"general":"Genel","moderation":"Moderasyon","appearance":"Görünüm","email":"Eposta"}},"flagging":{"title":"Topluluğumuzun nezaket kuralları içerisinde kalmasına sağladığın destek için teşekkürler!","action":"Gönderiyi Bayrakla İşaretle","take_action":"Harekete Geç","notify_action":"Mesaj","official_warning":"Resmi uyarı","delete_spammer":"İstenmeyen e-postayı göndereni sil","yes_delete_spammer":"Evet, İstenmeyen E-postayı Göndereni Sil","ip_address_missing":"(uygulanamaz)","hidden_email_address":"(gizli)","submit_tooltip":"Özel bayrağı gönder","take_action_tooltip":"Grubundan daha fazla bayrak beklemek yerine bunu hızlıca yaparak alt sınıra erişebilirsin","cant":"Üzgünüz, şu an bu gönderiyi bayrakla işaretleyemezsin.","notify_staff":"Görevliye özel olarak bildir","formatted_name":{"off_topic":"Konu Dışı","inappropriate":"Uygunsuz","spam":"İstenmeyen"},"custom_placeholder_notify_user":"Açıklayıcı, yapıcı ve her zaman nazik ol.","custom_placeholder_notify_moderators":"Seni neyin endişelendirdiğini açık bir dille bize bildir ve gerekli yerlerde konu ile alakalı bağlantıları paylaş.","custom_message":{"at_least":{"one":"en azından {{count}} karakter girin","other":"en azından {{count}} karakter gir"},"more":{"one":"{{count}} daha...","other":"{{count}} daha..."},"left":{"one":"{{count}} kaldı","other":"{{count}} kaldı"}}},"flagging_topic":{"title":"Topluluğumuzun nezaket kuralları içerisinde kalmasına verdiğin destek için teşekkürler!","action":"Konuyu Bayrakla İşaretle","notify_action":"Mesaj"},"topic_map":{"title":"Konu Özeti","participants_title":"Sıkça Gönderi Yapanlar","links_title":"Popüler Bağlantılar","links_shown":"daha fazla bağlantı göster...","clicks":{"one":"%{count} tıklama","other":"%{count} tıklama"}},"post_links":{"about":"bu gönderi için daha fazla bağlantı koy","title":{"one":"%{count} daha","other":"%{count} daha"}},"topic_statuses":{"warning":{"help":"Bu resmi bir uyarıdır."},"bookmarked":{"help":"Bu konuyu işaretledin"},"locked":{"help":"Bu konu kapatıldığı için artık yeni cevap kabul edilmiyor"},"archived":{"help":"Bu başlık arşivlendi; donduruldu ve değiştirilemez"},"locked_and_archived":{"help":"Bu konu kapatıldı ve arşivlendi; yeni cevaplar kabul edilemez ve değiştirilemez."},"unpinned":{"title":"En Yukarıda Sabitlenmesi Kaldırıldı","help":"Bu konu senin için artık en yukarıda sabitli değil, yani artık sırasıyla görüntülenecek"},"pinned_globally":{"title":"Her Yerde En Yukarıda Sabitlendi","help":"Bu konu her yerde en yukarıda sabitlendi; gönderildiği kategori ve son gönderilerin en üstünde görünecek. "},"pinned":{"title":"En Yukarıda Sabitlendi","help":"Bu konu senin için en yukarıda sabitlendi; kendi kategorisinin en üstünde görünecek"},"unlisted":{"help":"Bu konu listelenmemiş; konu listelerinde görüntülenmeyecek ve sadece doğrudan bir bağlantı üzerinden erişilebilecek"},"personal_message":{"title":"Bu konu kişisel bir mesajdır","help":"Bu konu kişisel bir mesajdır"}},"posts":"Gönderiler","posts_long":"bu konuda {{number}} gönderi var","original_post":"Orjinal Gönderi","views":"Görüntülenenler","views_lowercase":{"one":"gösterim","other":"görüntülenenler"},"replies":"Cevaplar","views_long":{"one":"bu konu {{number}} defa görüntülendi","other":"bu konu {{number}} defa görüntülendi"},"activity":"Aktivite","likes":"Beğeni","likes_lowercase":{"one":"beğeni","other":"beğeni"},"likes_long":"bu konuda {{number}} beğeni var","users":"Kullanıcılar","users_lowercase":{"one":"kullanıcı","other":"kullanıcılar"},"category_title":"Kategori","history":"Geçmiş","changed_by":"Yazan {{author}}","raw_email":{"title":"Gelen e-posta","not_available":"Bulunmuyor!"},"categories_list":"Kategori Listesi","filters":{"with_topics":"%{filter} konular","with_category":"%{filter} %{category} konular","latest":{"title":"En son","title_with_count":{"one":"En Son ({{count}})","other":"En Son ({{count}})"},"help":"yakın zamanda gönderi alan konular"},"read":{"title":"Okunmuş","help":"okunma sırasına göre okuduğun konular"},"categories":{"title":"Kategoriler","title_in":"Kategori - {{categoryName}}","help":"kategoriye göre gruplandırılmış konular"},"unread":{"title":"Okunmamış","title_with_count":{"one":"Okunmamış ({{count}})","other":"Okunmamış ({{count}})"},"help":"İzlediğin veya takip ettiğin okunmamış gönderi konuları","lower_title_with_count":{"one":"{{count}} okunmamış","other":"{{count}} okunmamış"}},"new":{"lower_title_with_count":{"one":"{{count}} yeni","other":"{{count}} yeni"},"lower_title":"yeni","title":"Yeni","title_with_count":{"one":"Yeni ({{count}}) ","other":"Yeni ({{count}}) "},"help":"son birkaç günde oluşturulmuş konular"},"posted":{"title":"Gönderilerim","help":"gönderi yaptığın konular"},"bookmarks":{"title":"İşaretler","help":"işaretlediğin konular"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} kategorisindeki en son konular"},"top":{"title":"Popüler","help":"geçtiğimiz yıl, ay, hafta veya gündeki en etkin başlıklar","all":{"title":"Tüm Zamanlar"},"yearly":{"title":"Yıllık"},"quarterly":{"title":"Üç aylık"},"monthly":{"title":"Aylık"},"weekly":{"title":"Haftalık"},"daily":{"title":"Günlük"},"all_time":"Tüm Zamanlar","this_year":"Yıl","this_quarter":"Çeyrek","this_month":"Ay","this_week":"Hafta","today":"Bugün","other_periods":"yukarı bak"},"votes":{"title":"Oylar","help":"en çok oy alan konular"}},"browser_update":"Maalesef,  \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003etarayıcın bu site için çok eski\u003c/a\u003e. Lütfen \u003ca href=\"https://browsehappy.com\"\u003etarayıcını güncelle\u003c/a\u003e.","permission_types":{"full":"Oluştur / Cevapla / Bak","create_post":"Cevapla / Bak","readonly":"Bak"},"lightbox":{"download":"indir","previous":"Önceki (Sol ok tuşu)","next":"Sonraki (Sağ ok tuşu)","counter":"%curr% of %total%","close":"Kapat (Esc)","content_load_error":"\u003ca href=\"%url%\"\u003eİçerik\u003c/a\u003e yüklenemedi.","image_load_error":"\u003ca href=\"%url%\"\u003eResim\u003c/a\u003e yüklenemedi."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":",","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} veya %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"Klavye Kısayolları","jump_to":{"title":"Şuraya git","home":"%{shortcut} Anasayfa","latest":"%{shortcut} En son","new":"%{shortcut} Yeni","unread":"%{shortcut} Okunmamış","categories":"%{shortcut} Kategoriler","top":"%{shortcut} En üst","bookmarks":"%{shortcut} İşaretler","profile":"%{shortcut} Profil","messages":"%{shortcut} Mesajlar","drafts":"%{shortcut} Taslaklar"},"navigation":{"title":"Navigasyon","jump":"%{shortcut} Gönderiye git #","back":"%{shortcut} Geri","up_down":"%{shortcut} Seçileni taşı \u0026uarr; \u0026darr;","open":"%{shortcut} Seçili konuyu aç","next_prev":"%{shortcut} Önceki/Sonraki bölüm","go_to_unread_post":"%{shortcut} Okunmamış ilk gönderiye git"},"application":{"title":"Uygulama","create":"%{shortcut} Yeni konu oluştur","notifications":"%{shortcut} Bildirimleri aç","hamburger_menu":"%{shortcut} Hamburger menüyü aç","user_profile_menu":"%{shortcut} Kullanıcı menüsünü aç","show_incoming_updated_topics":"%{shortcut} Güncellenmiş konuları göster","search":"%{shortcut} Ara","help":"%{shortcut} Klavye yardım sayfasını aç","dismiss_new_posts":"%{shortcut} Yeni Konuları/Gönderileri Yoksay","dismiss_topics":"%{shortcut} Konuları yoksay","log_out":"%{shortcut} Çıkış"},"composing":{"title":"Oluşturma","return":"%{shortcut} Düzenleyiciye  dön","fullscreen":"%{shortcut} Tam ekran düzenleyici"},"actions":{"title":"Eylemler","bookmark_topic":"%{shortcut} Konu işaretini değiştir","pin_unpin_topic":"%{shortcut} Konuyu en yukarıda sabitle/sabitleme","share_topic":"%{shortcut} Konuyu paylaş","share_post":"%{shortcut} Gönderiyi paylaş","reply_as_new_topic":"%{shortcut} Bağlantılı konu olarak cevapla","reply_topic":"%{shortcut} Konuyu cevapla","reply_post":"%{shortcut} Gönderiyi cevapla","quote_post":"%{shortcut} Gönderiyi alıntıla","like":"%{shortcut} Gönderiyi beğen","flag":"%{shortcut} Gönderiyi bayrakla işaretle","bookmark":"%{shortcut} Gönderiyi işaretle","edit":"%{shortcut} Gönderiyi düzenle","delete":"%{shortcut} Gönderiyi sil","mark_muted":"%{shortcut} Konuyu sessize al","mark_regular":"%{shortcut} Öntanımlı konu","mark_tracking":"%{shortcut} Konuyu takip et","mark_watching":"%{shortcut} Konuyu izle","print":"%{shortcut} Konuyu yazdır","defer":"%{shortcut}Konuyu ertele","topic_admin_actions":"%{shortcut} Açık konu yönetici işlemleri"}},"badges":{"earned_n_times":{"one":"Bu rozet %{count} defa kazanılmış","other":"Bu rozet %{count} defa kazanılmış"},"granted_on":"%{date} tarihinde verildi","others_count":"Bu rozete sahip diğer kişiler (%{count})","title":"Rozetler","allow_title":"Bu rozeti başlık olarak kullanabilirsin","multiple_grant":"Bunu birden çok kez kazanabilirsin","badge_count":{"one":"%{count} Rozet","other":"%{count} Rozet"},"more_badges":{"one":"+%{count} Daha","other":"+%{count} Daha"},"granted":{"one":"%{count} izin verildi","other":"%{count} izin verildi"},"select_badge_for_title":"Başlık olarak kullanılacak bir rozet seç","none":"(hiçbiri)","successfully_granted":"%{username} başarıyla %{badge} kazanmıştır","badge_grouping":{"getting_started":{"name":"Başlangıç"},"community":{"name":"Topluluk"},"trust_level":{"name":"Güven Seviyesi"},"other":{"name":"Diğer"},"posting":{"name":"Gönderiliyor"}}},"tagging":{"all_tags":"Tüm Etiketler","other_tags":"Diğer Etiketler","selector_all_tags":"tüm etiketler","selector_no_tags":"etiket yok","changed":"değişen etiketler:","tags":"Etiketler","choose_for_topic":"opsiyonel etiketler","info":"Bilgi","default_info":"Bu etiket hiçbir kategoriyle sınırlandırılmamıştır, ve eş anlamlısı yoktur.","category_restricted":"Bu etiket, erişim izniniz olmayan kategorilerle sınırlıdır.","synonyms":"Eş Anlamlılar","synonyms_description":"İlgili etiketler kullanılıyorsa, \u003cb\u003e%{base_tag_name}\u003c/b\u003e ile değiştirilecektir.","tag_groups_info":{"one":"Bu etiket {{tag_groups}} grubuna aittir.","other":"Bu etiket \"{{tag_groups}}\" gruplarına aittir."},"category_restrictions":{"one":"Sadece bu kategoride kullanılabilir : ","other":"Sadece bu kategorilerde kullanılabilir : "},"edit_synonyms":"Eş anlamlıları Yönet","add_synonyms_label":"Eş anlamlılarını ekle:","add_synonyms":"Ekle","add_synonyms_explanation":{"one":"Şu anda bu etiketi kullanan herhangi bir yer, bunun yerine \u003cb\u003e%{tag_name}\u003c/b\u003e kullanacak şekilde değiştirilecektir. Bu değişikliği yapmak istediğinizden emin misiniz?","other":"Şu anda bu etiketleri kullanan herhangi bir yer, bunun yerine \u003cb\u003e%{tag_name}\u003c/b\u003e kullanacak şekilde değiştirilecektir. Bu değişikliği yapmak istediğinizden emin misiniz?"},"add_synonyms_failed":"Bu etiketler eş anlamlı olarak eklenemedi: \u003cb\u003e%{tag_names}\u003c/b\u003e. Eş anlamlıları olmadığından veya başka bir etiketin eş anlamlısı olmadığından emin olun.","remove_synonym":"Eş anlamlıları Kaldır","delete_synonym_confirm":"\"%{tag_name}\" Eş anlamlıları silmek istediğinizden emin misiniz ?","delete_tag":"Etiketi Sil","delete_confirm":{"one":"Bu etiketi silmek ve atanmış olduğu %{count} konudan kaldırmak istediğinizden emin misiniz?","other":"Bu etiketi silmek ve  atanmış olduğu {{count}} konularından kaldırmak istediğinizden emin misiniz? "},"delete_confirm_no_topics":"Bu etiketi silmek istediğinize emin misiniz?","delete_confirm_synonyms":{"one":"Eş anlamlısı da silinecek.","other":"{{count}} isimli eşanlamlıları da silinecek."},"rename_tag":"Etiketi Yeniden Adlandır","rename_instructions":"Bu etiket için yeni bir ad seç:","sort_by":"Sırala:","sort_by_count":"say","sort_by_name":"isim","manage_groups":"Etiket Grubunu Yönet","manage_groups_description":"Etiket grubunu yönetmek için grup tanımla","upload":"Etiketleri Yükle","upload_description":"Toplu olarak etiket oluşturmak için bir csv dosyası yükleyin","upload_instructions":"Her satıra bir tane, isteğe bağlı olarak 'tag_name, tag_group' biçiminde bir etiket grubu","upload_successful":"Etiketler başarıyla yüklendi","delete_unused_confirmation":{"one":"%{count} etiketi silinecek: %{tags}","other":"%{count} etiketleri silinecek: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} ve %{count} daha fazlası","other":"%{tags} ve %{count} daha fazlası"},"delete_unused":"Kullanılmayan Etiketleri Sil","delete_unused_description":"Hiçbir konuya veya kişisel mesaja eklenmeyen tüm etiketleri sil","cancel_delete_unused":"İptal","filters":{"without_category":"%{filter} %{tag} konular","with_category":"%{category} içerisindeki konular %{filter} %{tag}","untagged_without_category":"%{filter} etiketlenmemiş konular","untagged_with_category":"%{category} içindeki %{filter} etiketlenmemiş konular"},"notifications":{"watching":{"title":"İzleniyor","description":"Bu etiketi içeren tüm konuları otomatik olarak izleyeceksin. Tüm yeni mesajlar ve konulardan haberdar edileceksin, ayrıca konuların yanında okunmamış ve yeni mesajların sayısı da görünecek."},"watching_first_post":{"title":"İlk gönderi izlemesi","description":"Bu etiketteki yeni konular size bildirilecektir ancak konulara cevap verilmeyecektir."},"tracking":{"title":"Takip ediliyor","description":"Bu etiketi içeren tüm konuları otomatik olarak takip edeceksin. Konunun yanında okunmamış ve yeni yayınların sayısı görünecek."},"regular":{"title":"Düzenli","description":"Birisi @isminden bahsederse veya gönderine cevap verirse bildirim alacaksın."},"muted":{"title":"Sessiz","description":"Bu etiketle yeni konular hakkında hiçbir şeyden haberdar edilmeyeceksin ve konular okunmamış sekmesinde görünmeyecek. "}},"groups":{"title":"Etiket Grupları","about":"Konuları kolayca yönetmek için onlara etiket ekle.","new":"Yeni Grup","tags_label":"Bu gruptaki etiketler:","tags_placeholder":"etiketler","parent_tag_label":"Üst etiket:","parent_tag_placeholder":"İsteğe Bağlı","parent_tag_description":"Bu gruptaki etiketler üst etiket olduğu sürece kullanılamaz.","one_per_topic_label":"Bu etiket grubundan her konu için bir etiket ile sınır koy","new_name":"Yeni Etiket Grubu","name_placeholder":"Etiket Grubu Adı","save":"Kaydet","delete":"Sil","confirm_delete":"Bu etiket grubunu silmek istediğine emin misin?","everyone_can_use":"Etiketler herkes tarafından kullanılabilir","usable_only_by_staff":"Etiketler herkes tarafından görülebilir, ancak yalnızca görevli tarafından kullanabilir","visible_only_to_staff":"Etiketler yalnızca görevli tarafından görülebilir"},"topics":{"none":{"unread":"Okunmamış konun bulunmuyor.","new":"Yeni konun bulunmuyor","read":"Henüz bir konu okumadın.","posted":"Henüz herhangi bir konuya gönderim yapmadın.","latest":"Yeni eklenen konu bulunmuyor.","bookmarks":"Henüz işaretlenmemiş bir konun bulunmuyor.","top":"Güncel bir konu bulunmuyor."},"bottom":{"latest":"Yeni eklenmiş konu bulunmuyor.","posted":"Daha fazla gönderilmiş konu bulunmuyor.","read":"Okunacak daha fazla konu bulunmuyor.","new":"Daha fazla yeni konu bulunmuyor.","unread":"Daha fazla okunmamış konu bulunmuyor.","top":"Daha fazla güncel konu bulunmuyor.","bookmarks":"Daha fazla işaretlenmiş konu bulunmuyor."}}},"invite":{"custom_message":"Davetini az da olsa kişiselleştirilmiş \u003ca href\u003eözel bir mesajla\u003c/a\u003e yaz","custom_message_placeholder":"Kişiselleştirilmiş mesajlarını düzenle","custom_message_template_forum":"Hey, bu foruma katılmalısın!","custom_message_template_topic":"Hey, bu konu senin için eğlenceli olabilir!"},"forced_anonymous":"Aşırı yükleme nedeniyle, çıkış yapan bir kullanıcının göreceği şekilde herkese geçici olarak gösteriliyor. ","safe_mode":{"enabled":"Güvenli mod etkin, çıkmak için bu tarayıcı penceresini kapat"},"poll":{"voters":{"one":"oylayan","other":"oylayanlar"},"total_votes":{"one":"toplam oy","other":"toplam oy"},"average_rating":"Ortalama oran: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Oylar \u003cstrong\u003ehalka açıktır\u003c/strong\u003e."},"results":{"groups":{"title":"Bu ankette oy kullanabilmek için %{groups} üyesi olmanız gerekiyor."},"vote":{"title":"Sonuçlar \u003cstrong\u003eoylamada\u003c/strong\u003e gösterilecektir."},"closed":{"title":"Sonuçlar oylama \u003cstrong\u003ekapatıldıktan\u003c/strong\u003e sonra gösterilecektir."},"staff":{"title":"Sonuçlar yalnızca \u003cstrong\u003emoderatöre\u003c/strong\u003e gösterilir."}},"multiple":{"help":{"at_least_min_options":{"one":"En az \u003cstrong\u003e%{count}\u003c/strong\u003e seçeneği seçin","other":"En az \u003cstrong\u003e%{count}\u003c/strong\u003e seçecek seçiniz"},"up_to_max_options":{"one":"\u003cstrong\u003e%{count}\u003c/strong\u003e seçeneğe kadar seçebilirsiniz","other":"\u003cstrong\u003e%{count}\u003c/strong\u003e seçeneğe kadar seçebilirsiniz"},"x_options":{"one":"\u003cstrong\u003e%{count}\u003c/strong\u003e seçenek seçiniz","other":"\u003cstrong\u003e%{count}\u003c/strong\u003e seçenek seçiniz"},"between_min_and_max_options":"\u003cstrong\u003e%{min}\u003c/strong\u003e ve \u003cstrong\u003e%{max}\u003c/strong\u003e arasında seçenek seçiniz"}},"cast-votes":{"title":"Oyunuzu kullanın","label":"Şimdi oylayın!"},"show-results":{"title":"Anket sonuçlarını göster","label":"Sonuçları göster"},"hide-results":{"title":"Oylarınıza dönün","label":"Oylamayı göster"},"group-results":{"title":"Kullanıcı alanına göre oyları gruplandır","label":"Dökümü göster"},"ungroup-results":{"title":"Tüm oyları birleştir","label":"Sorunu gizle"},"export-results":{"title":"Anket sonuçlarını dışa aktarma","label":"Dışa Aktar"},"open":{"title":"Anketi başlat","label":"Başlat","confirm":"Bu anketi başlatmak istediğinize emin misiniz?"},"close":{"title":"Anketi bitir","label":"Bitir","confirm":"Bu anketi bitirmek istediğinize emin misiniz?"},"automatic_close":{"closes_in":"Kapatılmasına zaman \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e kapanmış."},"error_while_toggling_status":"Üzgünüz, anket durumunu değiştirme sırasında hata meydana geldi.","error_while_casting_votes":"Üzgünüz, oylarınızı dönüştürme sırasında hata meydana geldi.","error_while_fetching_voters":"Üzgünüz, oy verenleri görüntüleme sırasında hata meydana geldi","error_while_exporting_results":"Maalesef anket sonuçları dışa aktarılırken bir hata oluştu.","ui_builder":{"title":"Anket Oluştur","insert":"Anket Ekle","help":{"options_count":"En az 1 seçenek girin","invalid_values":"Minimum değer maksimum değerden küçük olmalıdır.","min_step_value":"Minimum adım değeri 1"},"poll_type":{"label":"Tür","regular":"Tekli seçim","multiple":"Çoklu Seçim","number":"Sayısal Değerlendirme"},"poll_result":{"label":"Sonuçlar","always":"Her zaman görünür","vote":"Oylamada","closed":"Kapatıldığında","staff":"Yalnızca moderatörler"},"poll_groups":{"label":"İzin verilen gruplar"},"poll_chart_type":{"label":"Grafik tipi"},"poll_config":{"max":"En fazla","min":"En az","step":"Aralık"},"poll_public":{"label":"Kimlerin oy verdiğini göster"},"poll_options":{"label":"Her satıra bir anket seçeneği girin"},"automatic_close":{"label":"Seçimi otomatik olarak kapat"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Tüm yeni başlayan kullanıcılar için yeni kullanıcı öğreticisini başlatın","welcome_message":"Hızlı başlangıç rehberi ile tüm yeni kullanıcılara hoş geldin mesajı gönder"}},"discourse_local_dates":{"relative_dates":{"today":"Bugün %{time}","tomorrow":"Yarın %{time}","yesterday":"Dün %{time}","countdown":{"passed":"tarih geçti"}},"title":"Tarih/saat ekle","create":{"form":{"insert":"Ekle","advanced_mode":"Gelişmiş mod","simple_mode":"Basit mod","format_description":"Kullanıcının tarihini görüntülemek için kullanılan format. Kullanıcı saat dilimi kelimesini görüntülemek için \u0026quot;\\ T \\ Z\u0026quot; kullanın (Avrupa / Paris)","timezones_title":"Görüntülenecek zaman dilimleri","timezones_description":"Saat dilimleri önizleme ve geri dönüş tarihlerini görüntülemek için kullanılacaktır.","recurring_title":"Yinelenme","recurring_description":"Bu olayın ne kadar sürede tekrar edeceğini belirleyin.Bu seçeneği el ile düzenleyebilir veya aşağıdaki anahtarlardan birini kullanabilirsiniz: yıllar, aylar, haftalar, günler, saatler, dakikalar, saniyeler, milisaniyeler.","recurring_none":"Tekrarlama yok","invalid_date":"Geçersiz tarih: Tarih ve saatin doğru olduğundan emin olun!","date_title":"Tarih","time_title":"Saat","format_title":"Tarih formatı","timezone":"Saat dilimi","until":"A kadar...","recurring":{"every_day":"Her gün","every_week":"Her hafta","every_two_weeks":"İki haftada bir","every_month":"Her ay","every_two_months":"İki ayda bir","every_three_months":"Üç ayda bir","every_six_months":"Altı ayda bir","every_year":"Her yıl"}}}},"details":{"title":"Detayları Gizle"},"presence":{"replying":"yanıtlama","editing":"düzenleme","replying_to_topic":{"one":"yanıtlama","other":"yanıtlama"}},"voting":{"title":"Oylama","reached_limit":"Oy hakkınız kalmadı, mevcut bir oyunuzu kaldırın!","list_votes":"Oylarınızı listeleyin","votes_nav_help":"en çok oy alan konular","voted":"Bu konuyu oyladınız","allow_topic_voting":"Kullanıcıların bu kategorideki konularda oy kullanmasına izin verilsin mi?","vote_title":"Oyla","vote_title_plural":"Oylar","voted_title":"Oylanmış","voting_closed_title":"Kapalı","voting_limit":"Sınır","votes_left":{"one":"{{count}} oyunuz kaldı, \u003ca href='{{path}}'\u003eoylarınızı görün\u003c/a\u003e .","other":"{{count}} oyunuz kaldı, \u003ca href='{{path}}'\u003eoylarınızı görün\u003c/a\u003e ."},"votes":{"one":"{{count}} oy","other":"{{count}} oylar"},"anonymous_button":{"one":"Oy","other":"Oylar"},"remove_vote":"Oyu geri al"},"adplugin":{"advertisement_label":"REKLAM"},"docker":{"upgrade":"Discourse yüklemeniz güncel değil.","perform_upgrade":"Güncellemek için buraya tıklayın."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"user":{"use_current_timezone":"使用现在的时区","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"}},"modal":{"dismiss_error":"忽略错误"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}"}},"topic":{"topic_status_update":{"num_of_days":"天数"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}}},"post":{"bookmarks":{"edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"keyboard_shortcuts_help":{"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}}},"post":{"controls":{"publish_page":"Page Publishing"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'tr_TR';
I18n.pluralizationRules.tr_TR = MessageFormat.locale.tr_TR;
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

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';

    var suffixes = {
        1: '\'inci',
        5: '\'inci',
        8: '\'inci',
        70: '\'inci',
        80: '\'inci',
        2: '\'nci',
        7: '\'nci',
        20: '\'nci',
        50: '\'nci',
        3: '\'üncü',
        4: '\'üncü',
        100: '\'üncü',
        6: '\'ncı',
        9: '\'uncu',
        10: '\'uncu',
        30: '\'uncu',
        60: '\'ıncı',
        90: '\'ıncı'
    };

    var tr = moment.defineLocale('tr', {
        months : 'Ocak_Şubat_Mart_Nisan_Mayıs_Haziran_Temmuz_Ağustos_Eylül_Ekim_Kasım_Aralık'.split('_'),
        monthsShort : 'Oca_Şub_Mar_Nis_May_Haz_Tem_Ağu_Eyl_Eki_Kas_Ara'.split('_'),
        weekdays : 'Pazar_Pazartesi_Salı_Çarşamba_Perşembe_Cuma_Cumartesi'.split('_'),
        weekdaysShort : 'Paz_Pts_Sal_Çar_Per_Cum_Cts'.split('_'),
        weekdaysMin : 'Pz_Pt_Sa_Ça_Pe_Cu_Ct'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[bugün saat] LT',
            nextDay : '[yarın saat] LT',
            nextWeek : '[gelecek] dddd [saat] LT',
            lastDay : '[dün] LT',
            lastWeek : '[geçen] dddd [saat] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s sonra',
            past : '%s önce',
            s : 'birkaç saniye',
            ss : '%d saniye',
            m : 'bir dakika',
            mm : '%d dakika',
            h : 'bir saat',
            hh : '%d saat',
            d : 'bir gün',
            dd : '%d gün',
            M : 'bir ay',
            MM : '%d ay',
            y : 'bir yıl',
            yy : '%d yıl'
        },
        ordinal: function (number, period) {
            switch (period) {
                case 'd':
                case 'D':
                case 'Do':
                case 'DD':
                    return number;
                default:
                    if (number === 0) {  // special case for zero
                        return number + '\'ıncı';
                    }
                    var a = number % 10,
                        b = number % 100 - a,
                        c = number >= 100 ? 100 : null;
                    return number + (suffixes[a] || suffixes[b] || suffixes[c]);
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 7th is the first week of the year.
        }
    });

    return tr;

})));

// moment-timezone-localization for lang code: tr

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Akra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Ababa","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Cezayir","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzavil","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Kahire","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Kazablanka","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Septe","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Konakri","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Darüsselam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Cibuti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"Layun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Cuba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Hartum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinşasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Librevil","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadişu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"Sao Tome","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Trablus","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunus","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Cordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Kosta Rika","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominika","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaika","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico City","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Kuzey Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Merkez, Kuzey Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Kuzey Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Porto Riko","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sao Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"Saint Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"St. Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"St. Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"St. Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"St. Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Showa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almatı","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadır","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aktav","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aktöbe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Aşkabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atırav","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Bağdat","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahreyn","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Bakü","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beyrut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bişkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kalküta","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Çita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Çoybalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Kolombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Şam","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dakka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Duşanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Gazimağusa","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gazze","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"El Halil","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hong Kong","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"İrkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Cakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Kudüs","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabil","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamçatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karaçi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Katmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Handiga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnoyarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuçing","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuveyt","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Makao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Maskat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Lefkoşa","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Pyongyang","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Katar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Kızılorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Yangon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyad","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"Ho Chi Minh Kenti","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sahalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Semerkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Şanghay","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapur","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Taipei","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Taşkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tiflis","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Tahran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokyo","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulan Batur","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumçi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Vientiane","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Yakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Yekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Erivan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azor Adaları","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Kanarya Adaları","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cape Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira Adaları","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Güney Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"St. Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sidney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Eş Güdümlü Evrensel Zaman","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrahan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Atina","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrad","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brüksel","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bükreş","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapeşte","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Büsingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Kişinev","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Kopenhag","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"İrlanda Standart SaatiDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Cebelitarık","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Man Adası","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"İstanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lizbon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"İngiltere Yaz SaatiLondra","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Lüksemburg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monako","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Moskova","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Prag","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Roma","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Saraybosna","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Üsküp","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofya","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stokholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tiran","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulyanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Ujgorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatikan","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Viyana","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Varşova","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporojye","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zürih","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Christmas","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Komor","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldivler","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Reunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Paskalya Adası","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Honolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Markiz Adaları","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
