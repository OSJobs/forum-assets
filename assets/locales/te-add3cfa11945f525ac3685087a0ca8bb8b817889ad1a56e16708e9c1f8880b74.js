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
I18n._compiledMFs = {"too_few_topics_and_posts_notice_MF" : function(d){
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "还有 ";
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
r += "/unread'>1 个未读主题</a>";
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
})() + " 个未读主题</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "/new'>1 个新</a>主题";
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
})() + " 个近期</a>主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "可以阅读，或者";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "浏览";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += "中的其他主题";
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
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "你将删除该用户的";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "<b>1</b>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "、该账户，并阻止其IP地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> 再次注册，并将其邮件地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 加入黑名单。你确定这用户是广告散布者吗？";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "这个主题有 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "，有很多人赞了该帖";
return r;
},
"med" : function(d){
var r = "";
r += "，有非常多人赞了该帖";
return r;
},
"high" : function(d){
var r = "";
r += "，大多数人赞了该帖";
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
r += "你将要删除 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "1 个主题";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["te"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。确定吗？";
return r;
}};
MessageFormat.locale.te = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
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

I18n.translations = {"te":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"బైటు","other":"బైట్లు"},"gb":"జీబీ","kb":"కేబీ","mb":"యంబీ","tb":"టీబీ"}}}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","long_no_year_no_time":"MMM D","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} క్రితం","tiny":{"half_a_minute":"\u003c 1ని","less_than_x_seconds":{"one":"\u003c %{count}సె","other":"\u003c %{count}సె"},"x_seconds":{"one":"%{count}సె","other":"%{count}సె"},"x_minutes":{"one":"%{count}ని","other":"%{count}ని"},"about_x_hours":{"one":"%{count}గ","other":"%{count}గం"},"x_days":{"one":"%{count}రో","other":"%{count}రో"},"about_x_years":{"one":"%{count}సం","other":"%{count}సం"},"over_x_years":{"one":"\u003e %{count}సం","other":"\u003e %{count}సం"},"almost_x_years":{"one":"%{count}సం","other":"%{count}సం"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} నిమిషం","other":"%{count} నిమిషాలు"},"x_hours":{"one":"%{count} గంట","other":"%{count} గంటలు"},"x_days":{"one":"%{count} రోజు","other":"%{count} రోజులు"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} నిమిషం ముందు","other":"%{count} నిమిషాలు ముందు"},"x_hours":{"one":"%{count} గంట క్రితం","other":"%{count} గంటల ముందు"},"x_days":{"one":"%{count} రోజు ముందు","other":"%{count} రోజుల ముందు"}},"later":{"x_days":{"one":"%{count} రోజు తర్వాత","other":"%{count} రోజుల తర్వాత"}},"previous_month":"గత నెల","next_month":"తరువాత నెల","placeholder":"తేదీ"},"share":{"post":"#%{postNumber} టపా","close":"మూసివేయి"},"emails_are_disabled":"బయటకు వెళ్లే అన్ని ఈమెయిల్లూ అధికారి నిశేధించాడు. ఇప్పుడు ఎటువంటి ఈమెయిల్ ప్రకటనలూ పంపవీలవదు.","themes":{"default_description":"అప్రమేయ"},"edit":"ఈ విషయపు శీర్షిక మరియు వర్గం సవరించు","not_implemented":"ఈ ఫీచరు ఇంకా ఇంప్లిమెటు చేయలేదు. క్షమాపణలు!","no_value":"లేదు","yes_value":"అవును","generic_error":"క్షమించాలి, ఒక దోషం తలెత్తింది","generic_error_with_reason":"ఒక దోషం జరిగింది: %{error}","sign_up":"సైన్ అప్","log_in":"లాగిన్","age":"వయసు","joined":"చేరినారు","admin_title":"అధికారి","show_more":"మరింత చూపు","show_help":"ఐచ్చికాలు","links":"లంకెలు","links_lowercase":{"one":"లంకె","other":"లంకెలు"},"faq":"తవసం","guidelines":"మార్గదర్శకాలు","privacy_policy":"అంతరంగికతా విధానం","privacy":"అంతరంగికత","tos":"సేవా నిబంధనలు","mobile_view":"చర సందర్శనం","desktop_view":"డెస్క్ టాప్ సందర్శనం","you":"మీరు","or":"లేదా","now":"ఇప్పుడే","read_more":"మరింత చదువు","more":"మరింత","less":"తక్కువ","never":"ఎప్పటికీ వద్దు","every_hour":"ప్రతి గంట","daily":"ప్రతిరోజూ","weekly":"ప్రతీవారం","max_of_count":"{{count}} గరిష్టం","alternation":"లేదా","character_count":{"one":"{{count}} అక్షరం","other":"{{count}} అక్షరాలు"},"suggested_topics":{"title":"సూచించే విషయాలు"},"about":{"simple_title":"గురించి","title":"%{title} గురించి","stats":"సైటు గణాంకాలు","our_admins":"మా అధికారులు","our_moderators":"మా నిర్వాహకులు","moderators":"నిర్వాహకులు","stat":{"all_time":"ఆల్ టైమ్","last_7_days":"చివరి 7","last_30_days":"చివరి 30"},"like_count":"ఇష్టాలు","topic_count":"విషయాలు","post_count":"టపాలు","user_count":"వాడుకరులు","active_user_count":"క్రియాశీల సభ్యులు","contact":"మమ్ము సంప్రదించండి","contact_info":"ఈ సంధర్భంలో క్లిష్టమైన సమస్య లేదా అత్యవసర విషయం సైట్ ను ప్రభావితం చేస్తుంది, దయచేసి మమ్మల్ని సంప్రదించండి %{contact_info}."},"bookmarked":{"title":"పేజీక","clear_bookmarks":"పేజీక లను తుడిచివేయి","help":{"bookmark":"ఈ అంశంపై మొదటి టపాకి పేజీకలను పెట్టండి","unbookmark":"ఈ అంశంపై అన్ని పేజీకలను తొలగించడానికి నొక్కండి"}},"bookmarks":{"created":"ఈ టపాకు పేజీక ఉంచారు","remove":"పేజీక తొలగించండి","save":"భద్రపరచు","reminders":{"tomorrow":"రేపు","next_week":"వచ్చే వారం","next_month":"వచ్చే నెల"}},"drafts":{"remove":"తొలగించు","abandon":{"yes_value":"అవును. వదిలేయండి","no_value":"లేదు, ఉంచండి"}},"preview":"మునుజూపు","cancel":"రద్దు","save":"మార్పులు భద్రపరచండి","saving":"భద్రపరుస్తున్నాం...","saved":"భద్రం!","upload":"ఎగుమతించు","uploading":"ఎగుమతవుతోంది...","uploaded":"ఎగుమతైంది!","enable":"చేతనం","disable":"అచేతనం","undo":"రద్దు","revert":"తిద్దు","failed":"విఫలం","banner":{"close":"బ్యానరు తుడువు"},"choose_topic":{"none_found":"ఎటువంటి విషయాలూ కనపడలేదు."},"review":{"explain":{"total":"మొత్తం"},"delete":"తొలగించు","settings":{"save_changes":"మార్పులను భద్రపరచు","title":"అమరికలు"},"filtered_user":"సభ్యుడు","user":{"username":"వాడుకరి పేరు","email":"ఈమెయిల్","name":"పేరు"},"topics":{"topic":"విషయం"},"edit":"సవరించు","save":"భద్రపరచు","cancel":"రద్దుచేయి","filters":{"all_categories":"(అన్ని వర్గాలు)","type":{"title":"రకం"},"refresh":"తాజా పరుచు","category":"వర్గం"},"scores":{"type":"రకం"},"statuses":{"pending":{"title":"పెండింగు"}},"types":{"reviewable_user":{"title":"సభ్యుడు"}},"approval":{"ok":"సరే"}},"user_action":{"user_posted_topic":"\u003ca href='{{topicUrl}}'\u003eవిషయాన్ని\u003c/a\u003e \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e రాసారు ","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eవిషయాన్ని\u003c/a\u003e రాసారు","user_replied_to_post":"\u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e కు \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e జవాబిచ్చారు","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e కు జవాబిచ్చారు","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003eకు \u003ca href='{{topicUrl}}'\u003eవిషయానికి\u003c/a\u003e జవాబిచ్చారు","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e కు \u003ca href='{{topicUrl}}'\u003eవిషయానికి\u003c/a\u003e జవాబిచ్చారు","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e ను ప్రస్తావించారు","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003eమిమ్ము\u003c/a\u003e ప్రస్తావించారు","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eమీరు\u003c/a\u003e, \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e ను ప్రస్తావించారు","posted_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e రాసారు","posted_by_you":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e రాసారు","sent_by_user":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e పంపారు","sent_by_you":"\u003ca href='{{userUrl}}'\u003eమీరు\u003c/a\u003e పంపారు"},"directory":{"title":"వాడుకరులు","topics_entered_long":"సందర్శించిన విషయాలు ","topic_count":"విషయాలు","post_count":"జవాబులు","days_visited":"సందర్శనాలు","days_visited_long":"దర్శించిన రోజులు","posts_read":"చదివిన","posts_read_long":"చదివిన టపాలు"},"groups":{"requests":{"reason":"కారణం"},"manage":{"name":"పేరు","full_name":"పూర్తి పేరు","delete_member_confirm":" '%{group}' గుంపు నుండి '%{username}' ను తొలగించాలా?","profile":{"title":"ప్రవర"},"interaction":{"posting":"రాస్తున్నారు"},"membership":{"title":"సభ్యత్వం"},"logs":{"title":"లాగ్స్","when":"ఎప్పుడు","action":"చర్య","subject":"సబ్జెక్టు","details":"వివరాలు"}},"add":"కలుపు","membership":"సభ్యత్వం","name":"పేరు","user_count":"వాడుకరులు","selector_placeholder":"సభ్యనామం రాయండి","index":{"title":"గుంపులు","automatic":"స్వీయంగా","public":"బహిరంగం","private":"అంతరంగికం","is_group_user":"సభ్యుడు","is_group_owner":"యజమాని"},"activity":"కార్యకలాపం","members":{"title":"సభ్యులు","filter_placeholder":"వాడుకరి పేరు","owner":"యజమాని"},"topics":"విషయాలు","posts":"టపాలు","mentions":"ప్రస్తావనలు","messages":"సందేశాలు","alias_levels":{"nobody":"ఎవరూకాదు","only_admins":"కేవలం అధికారులే","mods_and_admins":"కేవలం అధికారులు మరియు నిర్వాహకులు మాత్రమే","members_mods_and_admins":"కేవలం గుంపు సభ్యులు, నిర్వాహకులు మరియు అధికారులు","everyone":"అందరూ"},"notifications":{"watching":{"title":"కన్నేసారు"},"tracking":{"title":"గమనిస్తున్నారు"},"muted":{"title":"నిశ్శబ్దం"}}},"user_action_groups":{"1":"ఇచ్చిన ఇష్టాలు ","2":"వచ్చిన ఇష్టాలు","3":"పేజీకలు","4":"విషయాలు","5":"జవాబులు","7":"ప్రస్తావనలు","9":"కోట్ లు","11":"సవరణలు","12":"పంపిన అంశాలు","13":"ఇన్ బాక్స్","14":"పెండింగు"},"categories":{"all":"అన్ని వర్గాలు","all_subcategories":"అన్నీ","no_subcategory":"ఏదీకాదు","category":"వర్గం","reorder":{"apply_all":"ఆపాదించు"},"posts":"టపాలు","topics":"విషయాలు","latest":"తాజా","latest_by":"నుండి తాజా","toggle_ordering":"వరుస నియంత్రణను అటుఇటుచేయి","subcategories":"ఉప వర్గాలు"},"ip_lookup":{"title":"ఐపీ చిరునామా లుకప్","hostname":"అతిథిపేరు","location":"ప్రాంతం","location_not_found":"(తెలీని)","organisation":"సంస్థ","phone":"ఫోన్","other_accounts":"ఈ ఐపీ చిరునామాతో ఇతర ఖాతాలు:","delete_other_accounts":"%{count} తొలగించు","username":"సభ్యనామం","trust_level":"టీయల్","read_time":"చదువు సమయం","topics_entered":"రాసిన విషయాలు ","post_count":"# టపాలు","confirm_delete_other_accounts":"మీరు నిజ్జంగా ఈ ఖాతాలు తొలగించాలనుకుంటున్నారా?"},"user":{"said":"{{username}}:","profile":"ప్రవర","mute":"నిశ్శబ్దం","edit":"అభిరుచులు సవరించు","download_archive":{"confirm":"మీరు నిజంగా మీ టపాల దిగుమతి కోరుకుంటున్నారా ?","rate_limit_error":"టపాలు కేవలం రోజుకు ఒకసారి మాత్రమే దిగుమతించుకోగలరు. దయచేసి రేపు ప్రయత్నించండి."},"private_messages":"సందేశాలు","user_notifications":{"ignore_duration_username":"వాడుకరి పేరు","mute_option":"నిశ్శబ్దం"},"activity_stream":"కలాపం","preferences":"అభిరుచులు","feature_topic_on_profile":{"save":"భద్రపరచు","clear":{"title":"శుభ్రపరుచు"}},"bookmarks":"పేజీకలు","bio":"నా గురించి","invited_by":"ఆహ్వానిచినవారు","trust_level":"నమ్మకపు స్థాయి","notifications":"ప్రకటనలు","statistics":"గణాంకాలు","dismiss_notifications_tooltip":"అన్ని చదవని ప్రకటనలూ చదివినట్టు గుర్తించు","external_links_in_new_tab":"అన్ని బాహ్య లంకెలనూ కొత్త ట్యాబులో తెరువు","enable_quoting":"హైలైట్ అయిన పాఠ్యానికి కోట్ జవాబు చేతనం చేయి","change":"మార్చు","moderator":"{{user}} ఒక నిర్వాహకుడు","admin":"{{user}} ఒక అధికారి","moderator_tooltip":"ఈ సభ్యుడు ఒక నిర్వాహకుడు","admin_tooltip":"ఈ సభ్యుడు ఒక అధికారి","suspended_notice":"ఈ సభ్యుడు {{date}} వరకూ సస్పెండయ్యాడు","suspended_reason":"కారణం:","github_profile":"గిట్ హబ్","tag_settings":"ట్యాగులు","watched_tags":"ఒకకన్నేసారు","tracked_tags":"గమనించారు","muted_tags":"నిశ్శబ్దం","watched_categories":"ఒకకన్నేసారు","tracked_categories":"గమనించారు","muted_categories":"నిశ్శబ్దం","delete_account":"నా ఖాతా తొలగించు","delete_account_confirm":"నిజ్జంగా మీరు మీ ఖాతాను శాస్వతంగా తొలగించాలనుకుంటున్నారా? ఈ చర్య రద్దుచేయలేరు సుమా! ","deleted_yourself":"మీ ఖాతా విజయవంతంగా తొలగించబడింది. ","unread_message_count":"సందేశాలు","admin_delete":"తొలగించు","users":"వాడుకరులు","muted_users":"నిశ్శబ్దం","tracked_topics_link":"చూపు","theme":"అలంకారం","staff_counters":{"flags_given":"సహాయకారి కేతనాలు","flagged_posts":"కేతనించిన టపాలు","deleted_posts":"తొగలించిన టపాలు","suspensions":"సస్పెన్షన్లు","warnings_received":"హెచ్చరికలు"},"messages":{"all":"అన్నీ","inbox":"ఇన్ బాక్స్","sent":"పంపిన","tags":"ట్యాగులు"},"preferences_nav":{"account":"ఖాతా","profile":"ప్రవర","notifications":"ప్రకటనలు","categories":"వర్గాలు","users":"వాడుకరులు","tags":"ట్యాగులు"},"change_password":{"success":"(ఈమెయిల్ పంపిన)","in_progress":"(ఈమెయిల్ పంపుతోన్నాం)","error":"(దోషం)","action":"సంకేతపద రీసెట్ ఈమెయిల్ పంపు","set_password":"సంకేతపదం అమర్చు"},"second_factor_backup":{"regenerate":"పునరుత్పత్తించు","disable":"అచేతనం","enable":"చేతనం"},"second_factor":{"name":"పేరు","edit":"సవరించు","security_key":{"delete":"తొలగించు"}},"change_about":{"title":"నా గురించి మార్చు"},"change_username":{"title":"సభ్యనామం మార్చు","taken":"క్షమించాలి, ఆ సభ్యనామం వేరొకరు తీసుకున్నారు.","invalid":"ఆ సభ్యనామం చెల్లనిది. కేవలం సంఖ్యలు, అక్షరాలు మాత్రమే కలిగి ఉండాలి. "},"change_email":{"title":"ఈమెయిల్ మార్చు","taken":"క్షమించాలి. ఆ ఈమెయిల్ అందుబాటులో లేదు.","error":"మీ ఈమెయిల్ మార్చడంలో దోషం. బహుశా ఆ చిరునామా ఇప్పటికే ఈ సైటులో వాడుకలో ఉందేమో? ","success":"ఆ చిరునామాకు మేము వేగు పంపాము. అందులోని సూచనలు అనుసరించండి. "},"change_avatar":{"title":"మీ ప్రవర బొమ్మ మార్చండి.","letter_based":"వ్యవస్థ కేటాయించిన ప్రవర బొమ్మ","uploaded_avatar":"అనురూప బొమ్మ","uploaded_avatar_empty":"అనురూప బొమ్మను కలపండి","upload_title":"మీ బొమ్మను కలపండి"},"change_card_background":{"title":"సభ్య కార్డు వెనుతలం","instructions":"వెనుతలం బొమ్మలు కేంద్రీకరించబడతాయి మరియు అప్రమేయ వెడల్పు 590 పిక్సెలు ఉంటాయి."},"email":{"title":"ఈమెయిల్","ok":"ద్రువపరుచుటకు మీకు ఈమెయిల్ పంపాము","invalid":"దయచేసి చెల్లుబాటులోని ఈమెయిల్ చిరునామా రాయండి","authenticated":"మీ ఈమెయిల్ {{provider}} చేత ద్రువీకరించబడింది","frequency_immediately":"మీకు వెంటనే ఈమెయిల్ చేసాము, మీరు ఈమెయిల్ విషయం చదవకపోతే. "},"associated_accounts":{"revoke":"రివోక్","cancel":"రద్దుచేయి"},"name":{"title":"పేరు","instructions":"మీ పూర్తి పేరు (ఐచ్ఛికం)","instructions_required":"మీ పూర్తి పేరు","too_short":"మీ పేరు మరీ చిన్నది","ok":"మీ పేరు బాగుంది"},"username":{"title":"వాడుకరి పేరు","short_instructions":"జనాలు మిమ్మల్ని @{{username}} అని ప్రస్తావించవచ్చు","available":"మీ సభ్యనామం అందుబాటులో ఉంది.","not_available":"అందుబాటులో లేదు. {{suggestion}} ప్రయత్నించండి?","not_available_no_suggestion":"అందుబాటులో లేదు","too_short":"మీ సభ్యనామం మరీ చిన్నది","too_long":"మీ సభ్యనామం మరీ పొడుగు","checking":"సభ్యనామం అందుబాటు పరిశీలిస్తున్నాం...","prefilled":"ఈమెయిల్ రిజిస్టరు అయిన సభ్యనామంతో సరిపోతోంది"},"locale":{"title":"ఇంటర్ఫేస్ భాష","instructions":"యూజర్ ఇంటర్ఫేస్ భాష. పుట తాజాపరిస్తే ఇది మారుతుంది. ","default":"(అప్రమేయ)"},"password_confirmation":{"title":"సంకేతపదం మరలా"},"auth_tokens":{"ip":"ఐపీ","details":"వివరాలు"},"last_posted":"చివరి టపా","last_emailed":"చివరగా ఈమెయిల్ చేసింది","last_seen":"చూసినది","created":"చేరినది","log_out":"లాగవుట్","location":"ప్రాంతం","website":"వెబ్ సైటు","email_settings":"ఈమెయిల్","like_notification_frequency":{"always":"ఎల్లప్పుడూ"},"email_previous_replies":{"always":"ఎల్లప్పుడూ","never":"ఎప్పటికీ వద్దు"},"email_digests":{"daily":"ప్రతీరోజు","weekly":"ప్రతీవారం"},"email_level":{"always":"ఎల్లప్పుడూ","never":"ఎప్పటికీ వద్దు"},"other_settings":"ఇతర","categories_settings":"వర్గాలు","new_topic_duration":{"label":"విషయాలు కొత్తగా భావించు, ఎప్పుడంటే","not_viewed":"నేను వాటిని ఇంకా చూడనప్పుడు","last_here":"నేను చివరిసారి ఇక్కడికి వచ్చిన తర్వాత సృష్టించినవి"},"auto_track_topics":"నేను రాసే విషయాలు ఆటోమేటిగ్గా గమనించు","auto_track_options":{"never":"ఎప్పటికీ వద్దు","immediately":"వెంటనే"},"invited":{"search":"ఆహ్వానాలను వెతకడానికి రాయండి ... ","title":"ఆహ్వానాలు","user":"ఆహ్వానించిన సభ్యుడు","redeemed":"మన్నించిన ఆహ్వానాలు","redeemed_tab":"మన్నించిన","redeemed_at":"మన్నించిన","pending":"పెండింగులోని ఆహ్వానాలు","pending_tab":"పెండింగు","topics_entered":"చూసిన విషయాలు","posts_read_count":"చదివిన టపాలు","expired":"ఈ ఆహ్వానం కాలాతీతమైంది.","rescind":"తొలగించు","rescinded":"ఆహ్వానం తొలగించారు","reinvite":"ఆహ్వానం మరలా పంపు","reinvited":"ఆహ్వానం మరలా పంపారు","time_read":"చదువు సమయం","days_visited":"దర్శించిన రోజులు","account_age_days":"రోజుల్లో ఖాతా వయసు","create":"ఒక ఆహ్వానం పంపు","bulk_invite":{"text":"దస్త్రం నుండి బహుళ ఆహ్వానాలు"}},"password":{"title":"సంకేతపదం","too_short":"మీ సంకేతపదం మరీ చిన్నది.","common":"ఆ సంకేతపదం మరీ సాధారణం.","same_as_username":"మీ సంకేతపదం మీ వినియోగదారుపేరు ని పోలి ఉంది.","same_as_email":"మీ సంకేతపదం మీ ఈమెయిల్ ను పోలి ఉంది.","ok":"మీ సంకేతపదం బాగుంది."},"summary":{"title":"సారాంశం","stats":"గణాంకాలు","time_read":"చదువు సమయం","topics":"విషయాలు","replies":"జవాబులు"},"ip_address":{"title":"చివరి ఐపీ చిరునామా"},"registration_ip_address":{"title":"రిజిస్ట్రేషన్ ఐపీ చిరునామా"},"avatar":{"title":"ప్రవర బొమ్మ"},"title":{"title":"శీర్షిక"},"primary_group":{"title":"ప్రాథమిక గుంపు"},"filters":{"all":"అన్నీ"},"stream":{"posted_by":"టపా రాసినవారు","sent_by":"పంపినవారు","the_topic":"విషయం"}},"loading":"లోడవుతోంది...","errors":{"prev_page":"ఎక్కించుట ప్రయత్నిస్తున్నప్పుడు","reasons":{"network":"నెట్వర్క్ దోషం","server":"సేవిక దోషం","forbidden":"అనుమతి నిరాకరించబడింది","unknown":"దోషం"},"desc":{"network":"దయచేసి మీ కనక్షన్ సరిచూడండి. ","network_fixed":"ఇప్పుడు మరలా పనిచేస్తుంది.","server":"దోష కోడు: {{status}}","forbidden":"దాన్ని చూడటానికి మీకు అనుమతి లేదు","unknown":"ఏదో తేడా జరిగింది."},"buttons":{"back":"వెనక్కు వెళ్లండి","again":"మళ్ళీ ప్రయత్నించండి","fixed":"పుట ఎక్కించండి"}},"modal":{"close":"మూసివేయి"},"close":"మూసివేయి","assets_changed_confirm":"ఈ సైటు ఇప్పుడే ఉన్నతీకరించబడింది. కొత్త రూపాంతరం చూడటానికి తాజాపరచండి?","logout":"మీరు లాగవుట్ అయ్యారు.","refresh":"తాజాపరుచు","read_only_mode":{"login_disabled":"సేటు కేవలం చదివే రీతిలో ఉన్నప్పుడు లాగిన్ వీలవదు."},"learn_more":"మరింత తెలుసుకోండి...","year":"సంవత్సరం","year_desc":"గత 365 రోజులలో సృష్టించిన విషయాలు","month":"నెల","month_desc":"గత 30 రోజులలో సృష్టించిన విషయాలు","week":"వారం","week_desc":"గత 7 రోజులలో సృష్టించిన విషయాలు","day":"రోజు","first_post":"తొలి టపా","mute":"నిశ్శబ్దం","unmute":"వినిశ్శబ్దం","time_read":"చదివిన","signup_cta":{"sign_up":"సైన్ అప్"},"summary":{"enabled_description":"మీరు ఈ విషయపు సారాంశము చదువుతున్నారు. ఆసక్తికర టపాలు కమ్యునిటీ ఎంచుకుంటుంది. ","enable":"ఈ విషయాన్ని సంగ్రహించు","disable":"అన్ని టపాలూ చూపు"},"deleted_filter":{"enabled_description":"ఈ విషయం తొలగించిన టపాలు కలిగి ఉంది. అవి దాయబడ్డాయి.","disabled_description":"ఈ విషయంలోని తొలగించిన టపాలు చూపుతున్నాము.","enable":"తొలగించిన టపాలు దాయు","disable":"తొలగించిన టపాలు చూపు"},"email":"ఈమెయిల్","username":"వాడుకరి పేరు","last_seen":"చూసిన","created":"సృష్టించిన","created_lowercase":"సృష్టించిన","trust_level":"నమ్మకపు స్థాయి","search_hint":"సభ్యనామం, ఈమెయిల్ మరియు ఐపీ చిరునామా","create_account":{"title":"కొత్త ఖాతా సృష్టించు","failed":"ఏదో తేడా జరిగింది. బహుశా ఈమెయిల్ ఇప్పటికే ఈసైటులో రిజిస్టరు అయి ఉందేమో, సంకేతపదం మర్చిపోయా లంకె ప్రయత్నించు."},"forgot_password":{"action":"నేను నా సంకేతపదాన్ని మర్చిపోయాను","invite":"మీ సభ్యనామం లేదా ఈమెయిల్ చిరునామా రాయండి, మేము మీ సంకేతపదం మార్చే విధం మీకు ఈమెయిల్ చేస్తాము.","reset":"రీసెట్ సంకేతపదం","complete_username":"సభ్యనామం \u003cb\u003e%{username}\u003c/b\u003e తో ఈ ఖాతా సరిపోతే మీకు సంకేతపదం రీసెట్ చేసే సూచనలు ఈమెయిల్ ద్వారా వస్తాయి. ","complete_email":"ఈమెయిల్ \u003cb\u003e%{email}\u003c/b\u003e తో ఈ ఖాతా సరిపోతే మీకు సంకేతపదం రీసెట్ చేసే సూచనలు ఈమెయిల్ ద్వారా వస్తాయి. ","complete_username_not_found":"మీ సభ్యనామం \u003cb\u003e%{username}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు","button_ok":"సరే","button_help":"సహాయం"},"email_login":{"complete_username_not_found":"మీ సభ్యనామం \u003cb\u003e%{username}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు.","complete_email_not_found":"\u003cb\u003e%{email}\u003c/b\u003e తో ఏ ఖాతా సరిపోవడంలేదు","confirm_title":"%{site_name} కు కొనసాగండి"},"login":{"title":"లాగిన్","username":"వాడుకరి","password":"సంకేతపదం","email_placeholder":"ఈమెయిల్ లేదా సభ్యనామం","caps_lock_warning":"క్యాప్స్ లాక్ ఆన్ అయి ఉంది","error":"తెలీని దోషం","blank_username_or_password":"దయచేసి మీ ఈమెయిల్ లేదా సభ్యనామం మరియు సంకేతపదం రాయండి","reset_password":"రీసెట్ సంకేతపదం","logging_in":"ప్రవేశపెడ్తోన్నాం","or":"లేదా","authenticating":"ద్రువీకరిస్తున్నాము...","awaiting_activation":"మీ ఖాతా చేతనం కోసం ఎదురుచూస్తుంది. సంకేతపదం మర్చిపోయా లంకెను వాడు మరో చేతన ఈమెయిల్ పొందండి.","awaiting_approval":"మీ ఖాతా ఇంకా సిబ్బంది ఒప్పుకొనలేదు. సిబ్బంది ఒప్పుకోగానే మీకు ఒక ఈమెయిల్ వస్తుంది.","requires_invite":"క్షమించాలి. ఈ పోరమ్ ప్రవేశం కేవలం ఆహ్వానితులకు మాత్రమే.","not_activated":"మీరప్పుడే లాగిన్ అవ్వలేరు. గతంలో మేము మీకు చేతన ఈమెయల్ \u003cb\u003e{{sentTo}}\u003c/b\u003e కు పంపాము. దయచేసి ఆ వేగులోని సూచనలు పాటించి మీ ఖాతాను చేతనం చేసుకోండి.","not_allowed_from_ip_address":"ఆ ఐపీ చిరునామా నుండి మీరు లాగిన్ అవ్వలేరు.","admin_not_allowed_from_ip_address":"మీరు ఆ IP చిరునామా నుండి నిర్వాహకుని వలె లాగిన్ కాలేరు.","resend_activation_email":"చేతన ఈమెయిల్ మరలా పంపడానికి ఇక్కడ నొక్కండి.","sent_activation_email_again":"మీకు \u003cb\u003e{{currentEmail}}\u003c/b\u003e మరో చేతన ఈమెయిల్ పంపాము. అది చేరుకోడానికి కొద్ది నిమిషాలు పట్టవచ్చు. ఇంకా స్పామ్ ఫోల్డరు చూడటం మర్చిపోకండి సుమా. ","google_oauth2":{"name":"గూగుల్","title":"గూగుల్ తో"},"twitter":{"name":"ట్విట్టర్","title":"ట్విట్టరు తో"},"facebook":{"title":"ఫేస్ బుక్ తో"},"github":{"title":"గిట్ హబ్ తో"}},"invites":{"accept_title":"ఆహ్వానం","welcome_to":"%{site_name} కు సుస్వాగతం!","name_label":"పేరు","password_label":"సంకేతపదం అమర్చండి","optional_description":"(ఐచ్ఛికం)"},"password_reset":{"continue":"%{site_name} కు కొనసాగండి"},"emoji_set":{"apple_international":"యాపిల్ , అంతర్జాతీయ","google":"గూగుల్","twitter":"ట్విట్టర్"},"category_page_style":{"categories_only":"వర్గాలు మాత్రమే"},"conditional_loading_section":{"loading":"లోడవుతోంది..."},"emoji_picker":{"flags":"కేతనాలు"},"composer":{"options":"ఎంపికలు","blockquote_text":"బ్లాక్ కోట్","add_warning":"ఇది ఒక అధికారిక హెచ్చరిక","posting_not_on_topic":"ఏ విషయానికి మీరు జవాబివ్వాలనుకుంటున్నారు? ","saved_local_draft_tip":"స్థానికంగా భద్రం","similar_topics":"మీ విషయం దీని వలె ఉంది...","drafts_offline":"చిత్తుప్రతులు ఆఫ్లైను.","error":{"title_missing":"శీర్షిక తప్పనిసరి","title_too_short":"శీర్షిక కనీసం {{min}} అక్షరాలు ఉండాలి","title_too_long":"శీర్షిక {{max}} అక్షరాలకు మించి ఉండకూడదు","post_length":"టపా కనీసం {{min}} అక్షరాలు కలిగి ఉండాలి","category_missing":"మీరు ఒక వర్గాన్ని ఎంచుకోవాలి"},"save_edit":"దాచి సవరించు","reply_original":"మూల విషయంకు జవాబివ్వు","reply_here":"ఇక్కడ జవాబివ్వు","reply":"జవాబు","cancel":"రద్దుచేయి","title":"లేదా కంట్రోల్ + ఎంటర్ నొక్కు","users_placeholder":"ఒక సభ్యుడిని కలుపు","title_placeholder":"ఈ చర్చ దేనిగురించో ఒక లైనులో చెప్పండి?","edit_reason_placeholder":"మీరెందుకు సవరిస్తున్నారు?","view_new_post":"మీ కొత్త టపా చూడండి","saved":"భద్రం!","uploading":"ఎగుమతవుతోంది...","show_preview":"మునుజూపు చూపు \u0026raquo;","hide_preview":"\u0026laquo; మునుజూపు దాచు","quote_post_title":"మొత్తం టపాను కోట్ చేయి","bold_title":"బొద్దు","bold_text":"బొద్దు పాఠ్యం","italic_title":"వాలు","italic_text":"వాలు పాఠ్యం","link_title":"హైపర్ లంకె","link_description":"లంకె వివరణ ఇక్కడ రాయండి","link_dialog_title":"హైపర్ లంకె చొప్పించండి","link_optional_text":"ఐచ్చిక శీర్షిక","quote_title":"బ్లాక్ కోట్","quote_text":"బ్లాక్ కోట్","code_title":"ముందే అలంకరించిన పాఠ్యం","code_text":"ముందే అలంకరించిన పాఠ్యాన్ని 4 జాగాలు జరుపు","upload_title":"ఎగుమతించు","upload_description":"ఎగుమతి వివరణ ఇక్కడ రాయండి","olist_title":"సంఖ్యా జాబితా","ulist_title":"చుక్కల జాబితా","list_item":"జాబితా అంశం","help":"మార్క్ డైన్ సవరణ సహాయం","modal_ok":"సరే","modal_cancel":"రద్దుచేయి","admin_options_title":"ఈ విషయానికి ఐచ్చిక సిబ్బంది అమరికలు","composer_actions":{"reply":"జవాబు","edit":"సవరించు","create_topic":{"label":"కొత్త విషయం"}},"details_title":"సారాంశం"},"notifications":{"none":"ఈ సమయంలో ప్రకటనలు చూపలేకున్నాము.","titles":{"watching_first_post":"కొత్త విషయం"}},"upload_selector":{"title":"ఒక బొమ్మ కలుపు","title_with_attachments":"ఒక బొమ్మ లేదా దస్త్రం కలుపు","from_my_computer":"నా పరికరం నుండి","from_the_web":"జాలం నుండి","remote_tip":"బొమ్మకు లంకె","hint":"(మీరు వాటిని ఎడిటరులోకి లాగి వదిలెయ్యటు ద్వారా కూడా ఎగుమతించవచ్చు)","uploading":"ఎగుమతవుతోంది","default_image_alt_text":"బొమ్మ"},"search":{"title":"విషయాలు, టపాలు, సభ్యులు లేదా వర్గాలు వెతుకు","no_results":"ఎటువంటి ఫలితాలు దొరకలేదు.","searching":"వెతుకుతున్నామ్...","post_format":"{{username}} నుండి #{{post_number}}","search_google_button":"గూగుల్","search_google_title":"ఈ సైట్ వెదుకు","context":{"user":"@{{username}} యొక్క విషయాలు వెతుకు","topic":"ఈ విషయంలో వెతుకు"},"advanced":{"posted_by":{"label":"టపా రాసినవారు"}}},"hamburger_menu":"మరో విషయాల జాబితాకు లేదా వర్గానికి వెళ్లు","new_item":"కొత్త","go_back":"వెనక్కు మరలు","not_logged_in_user":"సభ్యుని ప్రస్తుత కలాపాల మరియు అభిరూపాల సారాంశ పుట","current_user":"మీ సభ్యపుటకు వెళ్లు","topics":{"bulk":{"reset_read":"రీలోడ్ రీసెట్","delete":"విషయాలు తొలగించు","dismiss_new":"కొత్తవి తుడువు","toggle":"విషయాల బహుళ ఎంపికలు అటుఇటుచేయి","actions":"బహుళ చర్యలు","close_topics":"విషయాలు మూయు","archive_topics":"విషయాలు కట్టకట్టు","notification_level":"ప్రకటనలు","choose_new_category":"విషయం కొరకు కొత్త వర్గం ఎంచుకొండి:","selected":{"one":"మీరు \u003cb\u003e%{count}\u003c/b\u003e విషయం ఎంచుకున్నారు.","other":" మీరు \u003cb\u003e{{count}}\u003c/b\u003e విషయాలు ఎంచుకున్నారు."}},"none":{"unread":"మీరు చదవని విషయాలు లేవు","new":"మీకు కొత్త విషయాలు లేవు","read":"మీరింకా ఏ విషయాలూ చదవలేదు.","posted":"మీరింకా ఏ విషయాలూ రాయలేదు.","latest":"కొత్త విషయాలు లేవు. అహో ఎంతటి విపరిణామం.","bookmarks":"మీకింకా ఎట్టి పేజీక విషయాలూ లేవు.","category":"ఎట్టి {{category}} విషయాలూ లేవు","top":"ఎట్టి అగ్ర విషయాలూ లేవు."},"bottom":{"latest":"ఇంకా కొత్త విషయాలు లేవు.","posted":"ఇంకా రాసిన విషయాలు లేవు.","read":"ఇంకా చదవని విషయాలు లేవు.","new":"కొత్త విషయాలు లేవు.","unread":"ఇంకా చదవని విషయాలు లేవు.","category":"ఇంకా {{category}} విషయాలు లేవు.","top":"ఇంకా అగ్ర విషయాలు లేవు.","bookmarks":"ఇంకా పేజీక విషయాలు లేవు."}},"topic":{"create":"కొత్త విషయం","create_long":"కొత్త విషయం సృష్టించు","defer":{"title":"వాయిదావేయి"},"list":"విషయాలు","new":"కొత్త విషయం","unread":"చదవని","new_topics":{"one":"%{count} కొత్త విషయం","other":"{{count}} కొత్త విషయాలు"},"unread_topics":{"one":"%{count} చదవని విషయం","other":"{{count}} చదవని విషయాలు"},"title":"విషయం","invalid_access":{"title":"విషయం ప్రైవేటు","description":"క్షమించాలి, ఆ విషయానికి మీకు అనుమతి లేదు!","login_required":"ఆ విషయం చదవడానికి మీరు లాగిన్ అయి ఉండాలి."},"server_error":{"title":"విషయాలు చూపుట విఫలమైంది","description":"క్షమించాలి. ఆ విషయం చూపలేకున్నాము. బహుశా కనక్షను సమస్య వల్ల అనుకుంటాను.దయచేసి మరలా ప్రయత్నించండి. సమస్య కొనసాగితే మాకు తెలియపర్చండి."},"not_found":{"title":"విషయం కనిపించలేదు","description":"క్షమించాలి. ఆ విషయం మేము కనుగొనలేకున్నాము. బహుశా నిర్వాహకులు దాన్ని తొలగించారేమో?"},"total_unread_posts":{"one":"మీకు ఈ విషయంలో %{count} చదవని టపా ఉంది","other":"మీకు ఈ విషయంలో {{count}} చదవని టపాలు ఉన్నాయి"},"unread_posts":{"one":"మీకు ఈ విషయంలో %{count} చదవని పాత టపా ఉంది","other":"మీకు ఈ విషయంలో {{count}} చదవని పాత టపాలు ఉన్నాయి"},"new_posts":{"one":"మీరు చివరసారి చదివాక ఈ విషయంలో %{count} కొత్త టపా వచ్చింది","other":"మీరు చివరసారి చదివాక ఈ విషయంలో {{count}} కొత్త టపాలు వచ్చాయి"},"likes":{"one":"ఈ విషయానికి %{count} ఇష్టం ఉంది","other":"ఈ విషయానికి {{count}} ఇష్టాలు ఉన్నాయి"},"back_to_list":"విషయాల జాబితాకు మరలు","options":"విషయపు ఐచ్చికాలు","show_links":"ఈ విషయంలో లంకెలు చూపు","toggle_information":"విషయపు వివరాలు అటుఇటుచేయి","read_more_in_category":"మరింత చదవాలనుకుంటున్నారా? {{catLink}} లేదా {{latestLink}} లో ఇతర విషయాలు చూడు.","read_more":"మరిన్ని చదవాలనుకుంటున్నారా? {{catLink}} లేదా {{latestLink}}.","browse_all_categories":"అన్ని వర్గాలూ జల్లించు","view_latest_topics":"తాజా విషయాలు చూడు","suggest_create_topic":"ఓ విషయమెందుకు సృష్టించకూడదూ?","jump_reply_up":"పాత జవాబుకు వెళ్లు","jump_reply_down":"తరువాతి జవాబుకు వెళ్లు","deleted":"ఈ విషయం తొలగించబడింది","auto_update_input":{"tomorrow":"రేపు","this_weekend":"ఈ వారాంతం","next_week":"వచ్చే వారం","two_weeks":"రెండు వారాలు","next_month":"వచ్చే నెల","three_months":"మూడు నెలలు","six_months":"ఆరు నెలలు"},"auto_close":{"error":"దయచేసి చెల్లే విలువ రాయండి","based_on_last_post":"ఈ విషయంలో చివరి టపా కనీసం ఇంత వయసు వచ్చేంతవరకూ విషయాన్ని మూయకు."},"status_update_notice":{"auto_close":"ఈ విషయం %{timeLeft} తర్వాత స్వీయంగా మూయబడుతుంది.","auto_close_based_on_last_post":"చివరి జవాబు తర్వాత %{duration}కు ఈ విషయం స్వీయ మూయబడుతుంది"},"auto_close_title":"స్వీయ ముగింపు అమరికలు","timeline":{"back":"వెనుకకు","replies_short":"%{current} / %{total}"},"progress":{"title":"విషయపు పురోగతి","go_top":"అగ్ర","go_bottom":"అడుగు","go":"వెళ్లు","jump_bottom_with_number":"%{post_number} టపాకు వళ్లు","jump_prompt_or":"లేదా","total":"అన్ని టపాలు","current":"ప్రస్తుత టపా"},"notifications":{"reasons":{"3_6":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ వర్గాంపై కన్నేసారు","3_5":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే ఈ విషయం స్వీయ కన్నేసారు. ","3_2":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ విషయంపై కన్నేసారు.","3_1":"మీకు ప్రకటనలు వస్తాయి ఎందుకంటే మీరు ఈ విషయాన్ని సృష్టించారు.","3":"మీకు ప్రకటనలు వస్తాయి, ఎందుకంటే మీరు ఈ విషయంపై కన్నేసారు.","0_7":"ఈ వర్గంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు.","0_2":"ఈ విషయంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు.","0":"ఈ విషయంలోని అన్ని ప్రకటనలనూ మీరు విస్మరిస్తున్నారు."},"watching_pm":{"title":"కన్నేసారు"},"watching":{"title":"కన్నేసారు"},"tracking_pm":{"title":"గమనిస్తున్నారు"},"tracking":{"title":"గమనిస్తున్నారు"},"muted_pm":{"title":"నిశ్శబ్దం"},"muted":{"title":"నిశ్శబ్దం"}},"actions":{"title":"చర్యలు","recover":"విషయం తొలగింపు రద్దుచేయి","delete":"విషయం తొలగించు","open":"విషయం తెరువు","close":"విషయం మూయు","unarchive":"విషయాన్ని కట్టవిప్పు","archive":"విషయాన్ని కట్టకట్టు","invisible":"అజ్జాబితాగా గుర్తించు","visible":"జాబితాగా గుర్తించు","reset_read":"చదివిన గణాంకాలను రీసెట్ చేయి"},"feature":{"pin":"విషయం గుచ్చు","unpin":"విషయం అగ్గుచ్చు","pin_globally":"సార్వత్రికంగా విషయాన్ని గుచ్చు","make_banner":"బ్యానరు విషయం","remove_banner":"బ్యానరు విషయం తొలగించు"},"reply":{"title":"జవాబు","help":"ఈ విషయానికి జవాబివ్వుట ప్రారంభించు"},"clear_pin":{"title":"గుచ్చు శుభ్రపరుచు","help":"ఈ విషయపు గుచ్చు స్థితి శుభ్రపరుచు. తద్వారా అది ఇహ అగ్ర భాగాన కనిపించదు"},"share":{"title":"పంచు","help":"ఈ విషయపులంకెను పంచు"},"flag_topic":{"title":"కేతనం","help":"ఈ విషయాన్ని ప్రైవేటుగా కేతనించు లేదా ప్రైవేటు ప్రకటన పంపు","success_message":"ఈ విషయాన్ని మీరు కేతనించారు"},"inviting":"ఆహ్వానిస్తున్నామ్...","invite_private":{"email_or_username":"ఆహ్వానితుని ఈమెయిల్ లేదా సభ్యనామం","email_or_username_placeholder":"ఈమెయిల్ చిరునామా లేదా సభ్యనామం","action":"ఆహ్వానించు","error":"క్షమించాలి. ఆ సభ్యుడిని ఆహ్వానించుటలో దోషం.","group_name":"గుంపు పేరు"},"invite_reply":{"title":"ఆహ్వానించు","username_placeholder":"వాడుకరి పేరు","to_forum":"మేము మీ స్నేహితునికి ఒక ఈమెయిల్ పంపుతాము. అందులోని లంకె ద్వారా వారు లాగిన్ అవసరం లేకుండానే నేరుగా ఈ చర్చలో పాల్గొనవచ్చు, జవాబివ్వవచ్చు.","email_placeholder":"name@example.com"},"login_reply":"జవాబివ్వడానికి లాగిన్ అవ్వండి","filters":{"n_posts":{"one":"%{count} టపా","other":"{{count}} టపాలు"},"cancel":"జల్లెడ తొలగించు"},"split_topic":{"title":"కొత్త విషయానికి జరుపు","action":"కొత్త విషయానికి జరుపు","radio_label":"కొత్త విషయం","error":"టపాలను కొత్త విషయానికి జరిపేటప్పుడు దోషం తలెత్తింది","instructions":{"one":"మీరు కొత్త విషయం సృష్టించి దాన్ని మీరు ఈ టపాతో నింపబోతున్నారు.","other":"మీరు కొత్త విషయం సృష్టించి దాన్ని \u003cb\u003e{{count}}\u003c/b\u003e టపాలతో నింపబోతున్నారు."}},"merge_topic":{"title":"ఇప్పటికే ఉన్న విషయానికి జరుపు","action":"ఇప్పటికే ఉన్న విషయానికి జరుపు","error":" ఆ విషయంలోకి టపాలను జరపడంలో దోషం.","instructions":{"one":"ఈ టపాలు జరపాలనుకున్న విషయాన్ని ఎంచుకోండి.","other":"ఈ \u003cb\u003e{{count}}\u003c/b\u003e టపాలను జరపాలనుకున్న విషయాన్ని ఎంచుకోండి."}},"change_owner":{"action":"యజమానిని మార్చు","error":"ఆ టపాల యజమానిని మార్చేప్పుడు దోషం జరిగింది.","placeholder":"కొత్త యజమాని సభ్యనామం"},"multi_select":{"select":"ఎంచుకో","selected":"ఎంచుకున్నవి ({{count}})","select_post":{"label":"ఎంచుకో"},"select_replies":{"label":"ఎంచుకున్నవి +జవాబులు"},"delete":"ఎంచుకున్నవి తొలగించు","cancel":"ఎంపిక రద్దు","select_all":"అన్నీ ఎంచుకో","deselect_all":"అన్నీ వియెంచుకో","description":{"one":"మీరు \u003cb\u003e%{count}\u003c/b\u003e టపా ఎంచుకున్నారు","other":"మీరు \u003cb\u003e{{count}}\u003c/b\u003e టపాలు ఎంచుకున్నారు"}}},"post":{"edit_reason":"కారణం:","post_number":"టపా {{number}}","last_edited_on":"టపా చివర సవరించిన కాలం","reply_as_new_topic":"లంకె విషయంగా జవాబివ్వు","continue_discussion":"{{postLink}} నుండి చర్చ కొనసాగుతుంది;","follow_quote":"కోటెడ్ టపాకు వెళ్లు","show_full":"పూర్తి టపా చూపు","deleted_by_author":{"one":" (టపా రచయిత ద్వారా తొలగింపబడింది , స్వతస్సిధ్దంగా తొలగింపబ[ది %{count} కాకపోతే సమయం కేతనించలేదు)","other":"(టపా రచయిత ద్వారా ఉపసంహరించబడింది , స్వతసిధ్ధంగా తొలగించబడతాయి %{count} కాకపోతే సమయం కేతనించలేదు)"},"expand_collapse":"పెంచు/తుంచు","unread":"టపా చదవనిది","errors":{"create":"క్షమించాలి. మీ టపా సృష్టించుటలో దోషం. దయచేసి మరలా ప్రయత్నించండి. ","edit":"క్షమించాలి. మీ టపా సవరించుటలో దోషం. మరలా ప్రయత్నించండి","upload":"క్షమించాలి. దస్త్రం ఎగుమతించుటలో దోషం. దయచేసి మరలా ప్రయత్నించండి. ","too_many_uploads":"క్షమించాలి. మీరు ఒకసారి ఒక దస్త్రం మాత్రమే ఎగుమతించగలరు","image_upload_not_allowed_for_new_user":"క్షమించాలి. కొత్త సభ్యులు బొమ్మలు ఎగుమతి చేయలేరు.","attachment_upload_not_allowed_for_new_user":"క్షమించాలి. కొత్త సభ్యులు జోడింపులు ఎగుమతి చేయలేరు.","attachment_download_requires_login":"క్షమించాలి. జోడింపులు దిగుమతి చేసుకోవడానికి మీరు లాగిన్ అయి ఉండాలి."},"abandon_edit":{"no_value":"లేదు, ఉంచండి"},"abandon":{"confirm":"మీరు నిజంగానే మీ టపాను వదిలేద్దామనుకుంటున్నారా?","no_value":"లేదు, ఉంచండి","yes_value":"అవును. వదిలేయండి"},"via_email":"ఈ టపా ఈమెయిల్ ద్వారా వచ్చింది","archetypes":{"save":"భద్రపరుచు ఐచ్చికాలు"},"controls":{"reply":"ఈ టపాకు జవాబు రాయుట మొదలుపెట్టండి","like":"ఈ టపాను ఇష్టపడు","has_liked":"మీరు ఈ టపాను ఇష్టపడ్డారు","undo_like":"ఇష్టాన్ని రద్దుచేయి","edit":"ఈ టపాను సవరించు","edit_action":"సవరించు","edit_anonymous":"క్షమించాలి. ఈ టపాను సవరించడానికి మీరు లాగిన్ అయి ఉండాలి. ","flag":"దృష్టికొరకు ఈ టపాను ప్రైవేటుగా కేతనించు లేదా దీని గురించి ప్రైవేటు ప్రకటన పంపు","delete":"ఈ టపాను తొలగించు","undelete":"ఈ టపాను పునస్తాపించు","share":"ఈ టపా లంకెను పంచు","more":"మరింత","delete_replies":{"just_the_post":"లేదు, కేవలం ఈ టపానే"},"admin":"టపా అధికారి చర్యలు","wiki":"వికీ చేయి","unwiki":"వికీ తొలగించు","convert_to_moderator":"సిబ్బంది రంగు కలుపు","revert_to_regular":"సిబ్బంది రంగు తొలగించు","rebake":"హెచే టీ యం యల్ పునర్నిర్మించు","unhide":"చూపు","grant_badge":"బ్యాడ్జి ఇవ్వు","delete_topic":"విషయం తొలగించు"},"actions":{"flag":"కేతనం","undo":{"off_topic":"కేతనం రద్దు","spam":"కేతనం రద్దు","inappropriate":"కేతనం రద్దు","bookmark":"పేజీక రద్దు","like":"ఇష్టం రద్దు"},"people":{"off_topic":"దీన్ని విషయాంతరంగా కేతనించాము","spam":"దీన్ని స్పాముగా కేతనించాము","inappropriate":"దీన్ని అసమంజసమైనదిగా కేతనించాము"},"by_you":{"off_topic":"మీరు దీన్ని విషయాంతరంగా కేతనించారు","spam":"మీరు దీన్ని స్పాముగా కేతనించారు","inappropriate":"మీరు దీన్ని అసమంజసంగా కేతనించారు","notify_moderators":"మీరు దీన్ని నిర్వాహకుల దృష్టికి తెచ్చారు","bookmark":"మీరు దీనికి పేజీక ఉంచారు","like":"మీరు దీన్ని ఇష్టపడ్డారు"}},"revisions":{"controls":{"first":"తొలి దిద్దుబాటు","previous":"గత దిద్దుబాటు","next":"తరువాతి దిద్దుబాటు","last":"చివరి దిద్దుబాటు","hide":"దిద్దుబాటు దాచు","show":"దిద్దుబాటు చూపు"},"displays":{"inline":{"title":"వ్యవకలనాలు మరియు సంకలనాలను సాలు మధ్యలో చూపుతూ మొత్తం చూపు"},"side_by_side":{"title":"పక్క పక్కన తేడాలు చూపుతూ మొత్తం చూపు"},"side_by_side_markdown":{"title":"ముడి మూల తేడాను పక్కపక్కన చూపు"}}},"bookmarks":{"created":"సృష్టించిన","name":"పేరు"}},"category":{"can":"can\u0026hellip;","none":"(ఏ వర్గం లేదు)","edit":"సవరించు","view":"ఈ వర్గంలోని విషయాలు చూడు","general":"సాధారణ","settings":"అమరికలు","tags":"ట్యాగులు","delete":"వర్గం తొలగించు","create":"కొత్త వర్గం","save":"వర్గం దాచు","slug":"వర్గం స్లగ్","slug_placeholder":"(ఐచ్చికం) వెబ్ చిరునామాలో పేరు డాష్ లతో","creation_error":"ఈ వర్గం సృష్టించేప్పుడు దోషం","save_error":"ఈ వర్గం భద్రపరిచేప్పుడు దోషం","name":"వర్గం పేరు","description":"వివరణ","topic":"వర్గం విషయం","logo":"వర్గం లోగో బొమ్మ","background_image":"వర్గం వెనుతలపు బొమ్మ","badge_colors":"బ్యాడ్జి రంగులు","background_color":"వెనుతలపు రంగు","foreground_color":"మునుతలపు రంగు","name_placeholder":"గరిష్టం ఒకటి లేదా రెండు పదాలు","color_placeholder":"ఏదేనీ జాల రంగు","delete_confirm":"మీరు నిజంగా ఈ వర్గాన్ని తొలగించాలనుకుంటున్నారా?","delete_error":"ఈ వర్గం తొలగించేప్పుడు దొషం.","list":"వర్గాల జాబితా చూపు","no_description":"ఈ వర్గానికి వివరణ రాయండి","change_in_category_topic":"వివరణ సవరించు","already_used":"ఈ రంగు వేరే వర్గం వాడింది","security":"సంరక్షణ","images":"బొమ్మలు","email_in":"అనురూప లోపలికి వచ్చే ఈమెయిల్ చిరునామా:","email_in_allow_strangers":"ఎటువంటి ఖాతాలు లేని అనామక సభ్యుల నుండి వచ్చే ఈమెయిల్లు అంగీకరించు","email_in_disabled":"సైటు అమరికల్లో ఈమెయిల్ ద్వారా కొత్త విషయాలు రాయుడ అచేతనమైంది. ఈమెయిల్ ద్వారా కొత్త విషయాలు రాయుట చేతనం చేయుటకు,","email_in_disabled_click":"\"ఈమెయిల్ ఇన్\" అమరికను చేతనం చేయి.","allow_badges_label":"ఈ వర్గంలో బ్యాడ్జిలు బహూకరించుట అనుమతించు","edit_permissions":"అనుమతులు సవరించు","review_group_name":"గుంపు పేరు","this_year":"ఈ సంవత్సరం","default_position":"అప్రమేయ స్థానం","position_disabled":"వర్గాలు కలాపం వరుసలో చూపబడతాయి. జాబితాల్లో వర్గాల వరుసను నియంత్రించడానికి,","position_disabled_click":"\"స్థిర వర్గ స్థాయిలు\" అమరికను చేతనం చేయండి","parent":"తండ్రి వర్గం","notifications":{"watching":{"title":"కన్నేసారు"},"tracking":{"title":"గమనిస్తున్నారు"},"muted":{"title":"నిశ్శబ్దం"}},"sort_options":{"likes":"ఇష్టాలు","views":"చూపులు","posts":"టపాలు","activity":"కార్యకలాపం","category":"వర్గం","created":"సృష్టించిన"},"settings_sections":{"general":"సాధారణ","email":"ఈమెయిల్"}},"flagging":{"title":"మా కమ్యునిటీని నాగరికంగా ఉంచుటలో సహాయానికి ధన్యవాదములు","action":"టపాను కేతనించు","take_action":"చర్య తీసుకో","delete_spammer":"స్పామరును తొలగించు","yes_delete_spammer":"అవులు, స్పామరును తొలగించు","ip_address_missing":"వర్తించదు","hidden_email_address":"(దాయబడింది)","submit_tooltip":"ఒక ప్రైవేటు కేతనం అందించు","take_action_tooltip":"మరిన్ని కమ్యునిటీ కేతనాల కోసం ఎదురు చూడకుండా ఇప్పుడే కేతన గట్టు చేరు","cant":"క్షమించాలి. ఇప్పుడు ఈ టపాను కేతనిచంలేరు.","formatted_name":{"off_topic":"ఇది విషయాంతరం","inappropriate":"ఇది అసమంజసం","spam":"ఇది స్పాము"},"custom_placeholder_notify_user":"నిక్కచ్చిగా ఉండు, నిర్మాణాత్మకంగా ఉండు మరియు ఎల్లప్పుడూ దయతో ఉండు","custom_placeholder_notify_moderators":"మీరు ఏ విషయంలో ఇబ్బందిపడుతున్నారో మాకు తెలియజేయండి. ఉదాహరణలు, లంకెలు మరియు సంబంధిత సమాచారం పొందుపరచండి. "},"flagging_topic":{"title":"మా కమ్యునిటీని నాగరికంగా ఉంచుటలో సహాయానికి ధన్యవాదములు!","action":"విషయాన్ని కేతనించు"},"topic_map":{"title":"విషయ సారం","clicks":{"one":"ఒక నొక్కు","other":"%{count} నొక్కులు"}},"topic_statuses":{"warning":{"help":"ఇది అధికారిక హెచ్చరిక"},"bookmarked":{"help":"ఈ విషయానికి పేజీక ఉంచారు"},"locked":{"help":"ఈ విషయం ముగిసింది. కొత్త జవాబులు అంగీకరించదు. "},"archived":{"help":"ఈ విషయం కట్టకట్టబడింది. ఇది గడ్డకట్టుకుంది ఇహ మార్చయిత కాదు"},"unpinned":{"title":"అగ్గుచ్చిన","help":"ఈ విషయం మీకు అగ్గుచ్చబడింది. ఇది ఇహ క్రమ వరుసలోనే కనిపిస్తుంది"},"pinned_globally":{"title":"సార్వత్రికంగా గుచ్చారు"},"pinned":{"title":"గుచ్చారు","help":"ఈ విషయం మీకు గుచ్చబడింది. దాని వర్గంలో అది అగ్రభాగాన కనిపిస్తుంది."},"unlisted":{"help":"ఈ విషయం జాబితాలనుండి తొలగించబడింది. ఇహ కేవలం నేరు లంకె ద్వారా మాత్రమే చూడగలరు."}},"posts":"టపాలు","posts_long":"ఈ విషయానికి {{number}} టపాలు ఉన్నాయి. ","original_post":"మూల టపా","views":"చూపులు","replies":"జవాబులు","activity":"కలాపం","likes":"ఇష్టాలు","likes_long":"ఈ విషయానికి {{number}} ఇష్టాలు ఉన్నాయి","users":"సభ్యులు","users_lowercase":{"one":"వాడుకరి","other":"వాడుకరులు"},"category_title":"వర్గం","history":"చరిత్ర","changed_by":" {{author}} రాసిన","raw_email":{"not_available":"అందుబాటులో లేదు!"},"categories_list":"వర్గాల జాబితా","filters":{"with_topics":"%{filter} విషయాలు","with_category":"%{filter} %{category} విషయాలు","latest":{"title":"తాజా","help":"ఇటీవలి టపాలతోని విషయాలు"},"read":{"title":"చదివిన","help":"మీరు చదివిన విషయాలు, మీరు చివరిసారి చదివిన వరుసలో"},"categories":{"title":"వర్గాలు","title_in":"వర్గం - {{categoryName}}","help":"వర్గాల వారీగా జట్టు కట్టిన అన్ని విషయాలూ"},"unread":{"title":"చదవని","help":"మీరు ప్రస్తుతం కన్నేసిన లేదా గమనిస్తున్న చదవని టపాలతో ఉన్న విషయాలు "},"new":{"lower_title":"కొత్త","title":"కొత్త","help":"గత కొద్ది రోజులలో సృష్టించిన టపాలు"},"posted":{"title":"నా టపాలు","help":"మీరు టపా రాసిన విషయాలు"},"bookmarks":{"title":"పేజీకలు","help":"మీరు పేజీక ఉంచిన విషయాలు"},"category":{"title":"{{categoryName}}","help":"{{categoryName}} వర్గంలోని కొత్త విషయాలు"},"top":{"title":"అగ్ర","help":"గత సంవత్సరం, నెల, వారం లేదా రోజులోని అత్యంత క్రియాశీల విషయాలు","all":{"title":"ఆల్ టైమ్"},"all_time":"ఆల్ టైమ్","today":"ఈ రోజు"}},"permission_types":{"full":"సృష్టించి / జవాబివ్వు / చూడు","create_post":"జవాబివ్వు / చూడు","readonly":"చూడు"},"lightbox":{"download":"దిగుమతించు"},"keyboard_shortcuts_help":{"title":"కీబోర్డు షార్ట్ కట్లు","jump_to":{"title":"వెళ్లు","home":"%{shortcut} ముంగిలి","latest":"%{shortcut} తాజా","new":"%{shortcut} కొత్త","unread":"%{shortcut} చదవనవి","categories":"%{shortcut} వర్గాలు","top":"%{shortcut} పైన"},"navigation":{"title":"నావిగేషను","jump":"%{shortcut} టపాకు వెళ్లు #","back":"%{shortcut} వెనుకకు","open":"%{shortcut} ఎంచుకున్న విషయం తెరువు","next_prev":"%{shortcut} తర్వాతి/ముందరి విభాగం"},"application":{"title":"అనువర్తనం","create":"%{shortcut} కొత్త టపా సృష్టించు","notifications":"%{shortcut} తెరచిన ప్రకటనలు","user_profile_menu":"%{shortcut} యూజర్ మెనూ తెరువు","show_incoming_updated_topics":"%{shortcut} నవీకరించిన విషయాలను చూపించండి","help":"%{shortcut} కీ బోర్డ్ సహాయాన్ని తెరువు","dismiss_new_posts":"%{shortcut} తీసివేసిన కొత్త/టపాలు","dismiss_topics":"%{shortcut} తీసివేసిన విషయాలు"},"actions":{"title":"చర్యలు","pin_unpin_topic":"%{shortcut} విషయం చేర్చు/విడదీయు","share_topic":"%{shortcut} విషయం పంచు","share_post":"%{shortcut} టపా పంచు","reply_as_new_topic":"%{shortcut} లంకె విషయంగా సమాధానం","reply_topic":"%{shortcut} టపా కి సమాధానం","reply_post":"%{shortcut} టపా కి సమాధానం","like":"%{shortcut} టపా ని ఇష్టపడు","flag":"%{shortcut} టపా కేతనం","bookmark":"%{shortcut}టపా పేజీక","edit":"%{shortcut} టపా సవరణ","delete":"%{shortcut} టపా తొలగించు","mark_muted":"%{shortcut} విషయాన్ని ఆపివేయండి","mark_regular":"%{shortcut} నిత్య (అప్రమేయ) విషయం","mark_tracking":"%{shortcut} విషయం వెతుకు","mark_watching":"%{shortcut} చూసిన విషయం"}},"badges":{"title":"బ్యాడ్జీలు","select_badge_for_title":"మీ శీర్షికగా ఉపయోగించడానికి ఒక చిహ్నాన్ని ఎంపిక చేయండి.","badge_grouping":{"getting_started":{"name":"మొదలుపెట్టడం"},"community":{"name":"కమ్యునిటీ"},"trust_level":{"name":"నమ్మకం స్థాయి"},"other":{"name":"ఇతర"},"posting":{"name":"రాస్తున్నారు"}}},"tagging":{"tags":"ట్యాగులు","add_synonyms":"కలుపు","cancel_delete_unused":"రద్దుచేయి","notifications":{"watching":{"title":"కన్నేసారు"},"tracking":{"title":"గమనిస్తున్నారు"},"regular":{"title":"రెగ్యులరు","description":"ఎవరన్నా మీ @పేరు ప్రస్తావించినా లేదా జవాబిచ్చినా మీకు ప్రకటన వస్తుంది"},"muted":{"title":"నిశ్శబ్దం"}},"groups":{"save":"భద్రపరచు","delete":"తొలగించు"},"topics":{"none":{"unread":"మీరు చదవని విషయాలు లేవు","new":"మీకు కొత్త విషయాలు లేవు","read":"మీరింకా ఏ విషయాలూ చదవలేదు.","posted":"మీరింకా ఏ విషయాలూ రాయలేదు.","bookmarks":"మీకింకా ఎట్టి పేజీక విషయాలూ లేవు.","top":"ఎట్టి అగ్ర విషయాలూ లేవు."},"bottom":{"latest":"ఇంకా కొత్త విషయాలు లేవు.","posted":"ఇంకా రాసిన విషయాలు లేవు.","read":"ఇంకా చదవని విషయాలు లేవు.","new":"కొత్త విషయాలు లేవు.","unread":"ఇంకా చదవని విషయాలు లేవు.","top":"ఇంకా అగ్ర విషయాలు లేవు.","bookmarks":"ఇంకా పేజీక విషయాలు లేవు."}}},"poll":{"export-results":{"label":"ఎగుమతి"},"close":{"label":"మూసివేయి"},"ui_builder":{"poll_type":{"label":"రకం"},"poll_result":{"label":"ఫలితాలు"}}},"discourse_local_dates":{"create":{"form":{"time_title":"కాలం"}}},"voting":{"vote_title":"వోటు"},"docker":{"upgrade":"మీ డిస్కోర్సు ప్రతిష్టాపన కాలాతీతమైంది.","perform_upgrade":"ఉన్నతీకరించడానికి ఇక్కడ నొక్కండి"}}},"zh_CN":{"js":{"number":{"short":{"thousands":"{{number}}K","millions":"{{number}}M"}},"dates":{"time_short_day":"ddd, HH:mm","timeline_date":"YYYY[年]M[月]","long_no_year":"M[月]D[日] HH:mm","full_no_year_no_time":"M[月]D[日]","full_with_year_no_time":"YYYY[年]M[月]D[日]","tiny":{"less_than_x_minutes":{"other":"\u003c %{count} 分钟"},"x_months":{"other":"%{count} 个月"}},"medium_with_ago":{"x_months":{"other":"%{count} 个月前"},"x_years":{"other":"%{count} 年前"}},"later":{"x_months":{"other":"%{count} 个月后"},"x_years":{"other":"%{count} 年后"}}},"share":{"topic_html":"主题: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","twitter":"分享此链接至 Twitter","facebook":"分享此链接至 Facebook","email":"通过电子邮件分享此链接"},"action_codes":{"public_topic":"于%{when}将此主题设为公开","private_topic":"于%{when}将该主题转换为私信","split_topic":"于%{when}拆分了此主题","invited_user":"于%{when}邀请了 %{who}","invited_group":"于%{when}邀请了 %{who}","user_left":"%{who} 于%{when}离开了该私信","removed_user":"于%{when}移除了 %{who}","removed_group":"于%{when}移除了%{who}","autobumped":"于%{when}自动顶帖","autoclosed":{"enabled":"于%{when}关闭","disabled":"于%{when}打开"},"closed":{"enabled":"于%{when}关闭","disabled":"于%{when}打开"},"archived":{"enabled":"于%{when}存档","disabled":"于%{when}解除存档"},"pinned":{"enabled":"于%{when}置顶","disabled":"于%{when}解除置顶"},"pinned_globally":{"enabled":"于%{when}全站置顶","disabled":"于%{when}解除全站置顶"},"visible":{"enabled":"于%{when}列出","disabled":"于%{when}隐藏"},"banner":{"enabled":"于%{when}将此设置为横幅。用户关闭横幅前，横幅将显示在每一页的顶部。","disabled":"于%{when}移除了该横幅。横幅将不再显示在每一页的顶部。"},"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","wizard_required":"欢迎来到你新安装的 Discourse！让我们开始\u003ca href='%{url}' data-auto-route='true'\u003e设置向导\u003c/a\u003e✨","bootstrap_mode_enabled":"为方便新站点的冷启动，现正处于初始化模式中。所有新用户将被授予信任等级 1，并为他们启用每日邮件摘要。初始化模式会在用户数超过%{min_users}个时关闭。","bootstrap_mode_disabled":"初始化模式将会在24小时内关闭。","themes":{"broken_theme_alert":"因为主题或组件%{theme}有错误，你的网站可能无法正常运行。 在%{path}禁用它。"},"s3":{"regions":{"ap_northeast_1":"亚太地区（Tokyo）","ap_northeast_2":"亚太地区（Seoul）","ap_south_1":"亚太地区（Mumbai）","ap_southeast_1":"亚太地区（Singapore）","ap_southeast_2":"亚太地区（Sydney）","ca_central_1":"加拿大（中部）","cn_north_1":"中国（北京）","cn_northwest_1":"中国（宁夏）","eu_central_1":"欧洲（法兰克福）","eu_north_1":"欧洲（斯德哥尔摩）","eu_west_1":"欧洲（爱尔兰）","eu_west_2":"欧洲（伦敦）","eu_west_3":"欧洲（巴黎）","sa_east_1":"南美（圣保罗）","us_east_1":"美国东部（N. Virginia）","us_east_2":"美国东部（俄亥俄州）","us_gov_east_1":"AWS 政府云（US-East）","us_gov_west_1":"AWS 政府云（US-West）","us_west_1":"美国西部（N. California）","us_west_2":"美国西部（Oregon）"}},"expand":"展开","submit":"提交","go_ahead":"继续","rules":"规则","conduct":"行为准则","every_30_minutes":"每半小时","every_month":"每月","every_six_months":"每6个月","related_messages":{"title":"相关消息","see_all":"查看来自 @%{username} 的\u003ca href=\"%{path}\"\u003e所有消息\u003c/a\u003e ..."},"suggested_topics":{"pm_title":"推荐私信"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"not_bookmarked":"收藏此帖","created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","confirm_clear":"你确定要清空这个主题中的所有收藏？","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","later_today":"今天的某个时候","next_business_day":"下一个工作日","later_this_week":"这周的某个时候","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"drafts":{"resume":"复位","new_topic":"新主题草稿","new_private_message":"新私信草稿","topic_reply":"草稿回复","abandon":{"confirm":"你已在此主题中打开了另一个草稿。 你确定要舍弃它吗？"}},"topic_count_latest":{"other":"有 {{count}} 个更新或新主题"},"topic_count_unread":{"other":"有 {{count}} 个未读主题"},"topic_count_new":{"other":"有 {{count}} 个新主题"},"uploading_filename":"上传中：{{filename}}...","clipboard":"剪贴板","pasting":"粘贴中…","continue":"继续","switch_to_anon":"进入匿名模式","switch_from_anon":"退出匿名模式","banner":{"edit":"编辑该横幅 \u003e\u003e"},"pwa":{"install_banner":"你想要\u003ca href\u003e安装%{title}在此设备上吗？\u003c/a\u003e"},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"none_found":"无符合的结果","title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"order_by":"排序依据","in_reply_to":"回复给","explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","formula":"公式","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"awaiting_approval":"需要审核","settings":{"saved":"已保存！","priorities":{"title":"需审核优先级"}},"moderation_history":"管理日志","view_all":"查看全部","grouped_by_topic":"依据主题分组","none":"没有项目需要审核","view_pending":"查看待审核","topic_has_pending":{"other":"该主题中有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖等待审核中"},"title":"审核","topic":"主题：","filtered_topic":"您正在选择性地查看这一主题中的可审核内容。","show_all_topics":"显示所有主题","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站","fields":"字段"},"user_percentage":{"summary":{"other":"{{agreed}}，{{disagreed}}，{{ignored}}（共{{count}}个标记）"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}%忽略"}},"topics":{"reviewable_count":"计数","reported_by":"报告人","deleted":"[已删除的主题]","original":"（原主题）","details":"详情","unique_users":{"other":"{{count}} 位用户"}},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"type":{"all":"(全部类型)"},"minimum_score":"最低分：","status":"状态","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）","medium":"中","high":"高"}},"conversation":{"view_full":"查看完整对话"},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","score":"评分","date":"日期","status":"状态","submitted_by":"提交人","reviewed_by":"审核者"},"statuses":{"approved":{"title":"已批准"},"rejected":{"title":"拒绝"},"ignored":{"title":"忽略"},"deleted":{"title":"已删除"},"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_flagged_post":{"title":"被标记的帖子","flagged_by":"标记者"},"reviewable_queued_topic":{"title":"队列中到主题"},"reviewable_queued_post":{"title":"队列中的帖子"}},"approval":{"title":"等待审核中","description":"我们已经收到了你的发帖，不过帖子需要由版主审核才能显示。请耐心等待。","pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"directory":{"filter_name":"按用户名筛选","likes_given":"点赞","likes_received":"获得赞","topics_entered":"浏览","time_read":"阅读时长","topic_count_long":"创建的主题","post_count_long":"回帖数","no_results":"没有找到结果。","last_updated":"最近更新：","total_rows":{"other":"%{count} 位用户"}},"group_histories":{"actions":{"change_group_setting":"更改群组设置","add_user_to_group":"增加用户","remove_user_from_group":"移除用户","make_user_group_owner":"设为所有者","remove_user_as_group_owner":"撤销所有者"}},"groups":{"member_added":"已添加","member_requested":"请求于","add_members":{"title":"添加成员","description":"管理该群组的成员","usernames":"用户名"},"requests":{"title":"请求","accept":"接受","accepted":"已接受","deny":"拒绝","denied":"已拒绝","undone":"撤销请求","handle":"处理成员请求"},"manage":{"title":"管理","add_members":"添加成员","interaction":{"title":"交互","notification":"通知"},"membership":{"access":"访问"},"logs":{"acting_user":"模拟用户","target_user":"目标用户","from":"从","to":"到"}},"public_admission":"允许用户自由加入群组（需要群组公开可见）","public_exit":"允许用户自由离开群组","empty":{"posts":"群组成员没有发布帖子。","members":"群组没有成员。","requests":"没有请求加入此群组的请求。","mentions":"群组从未被提及过。","messages":"群组从未发送过私信。","topics":"群组的成员从未发表主题。","logs":"没有关于群组的日志。"},"join":"加入","leave":"离开","request":"请求","message":"私信","confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","membership_request_template":"用户发送会员请求时向其显示的自定义模板","membership_request":{"submit":"提交成员申请","title":"申请加入%{group_name}","reason":"向群组拥有者说明你为何属于这个群组"},"group_name":"群组名","bio":"关于群组","owner":"所有者","index":{"all":"所有群组","empty":"没有可见的群组。","filter":"根据群组类型筛选","owner_groups":"拥有的群组","close_groups":"关闭的群组","automatic_groups":"自动群组","closed":"已关闭","public_groups":"公开的群组","automatic_group":"自动群组","close_group":"关闭群组","my_groups":"我的群组","group_type":"群组类别"},"title":{"other":"群组"},"members":{"filter_placeholder_admin":"用户名或电子邮件","remove_member":"移除成员","remove_member_description":"从群组中移除\u003cb\u003e%{username}\u003c/b\u003e","make_owner":"设为所有者","make_owner_description":"使\u003cb\u003e%{username}\u003c/b\u003e成为群组所有者","remove_owner":"撤销所有者","remove_owner_description":"把\u003cb\u003e%{username}\u003c/b\u003e从群组所有者中移除","forbidden":"你不可以查看成员列表。"},"notification_level":"群组私信的默认通知等级","alias_levels":{"mentionable":"谁能@该群组","messageable":"谁能私信此群组","owners_mods_and_admins":"仅群组成员、版主与管理员"},"notifications":{"watching":{"description":"你将会在该私信中的每个新帖子发布后收到通知，并且会显示新回复数量。"},"watching_first_post":{"title":"监看新主题","description":"你将收到有关此组中新消息的通知，但不会回复消息。"},"tracking":{"description":"你会在别人@你或回复你时收到通知，并且新帖数量也将在这些主题后显示。"},"regular":{"title":"常规","description":"如果有人@你或回复你，将通知你。"},"muted":{"description":"你不会收到有关此组中消息的任何通知。"}},"flair_url":"头像图片","flair_url_placeholder":"（可选）图片 URL 或 Font Awesome class","flair_url_description":"使用不小于20px × 20px的方形图像或FontAwesome图标（可接受的格式：“fa-icon”，“far fa-icon”或“fab fa-icon”）。","flair_bg_color":"头像背景颜色","flair_bg_color_placeholder":"（可选）十六进制色彩值","flair_color":"头像颜色","flair_color_placeholder":"（可选）十六进制色彩值","flair_preview_icon":"预览图标","flair_preview_image":"预览图片"},"user_action_groups":{"6":"回应","15":"草稿"},"categories":{"category_list":"显示分类列表","reorder":{"title":"重新分类排序","title_long":"重新对分类列表进行排序","save":"保存排序","position":"位置"},"topic_sentence":{"other":"%{count} 主题"},"topic_stat_sentence_week":{"other":"过去一周有%{count}个新主题。"},"topic_stat_sentence_month":{"other":"过去一个月有%{count}个新主题。"},"n_more":"分类 (还有%{count}个分类) ..."},"ip_lookup":{"powered_by":"使用\u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"已复制"},"user_fields":{"none":"（选择一项）"},"user":{"download_archive":{"button_text":"全部下载","success":"下载开始，完成后将有私信通知你。"},"new_private_message":"发新私信","private_message":"私信","user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_save":"忽略","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_no_users":"你没有忽视任何用户","ignore_option":"忽略","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option":"普通","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","profile_hidden":"此用户公共信息已被隐藏。","expand_profile":"展开","collapse_profile":"折叠","timezone":"时区","desktop_notifications":{"label":"实时通知","not_supported":"通知功能暂不支持该浏览器。抱歉。","perm_default":"启用通知","perm_denied_btn":"拒绝授权","perm_denied_expl":"你拒绝了通知提醒的权限。设置浏览器以启用通知提醒。","disable":"停用通知","enable":"启用通知","each_browser_note":"注意：你必须在你使用的所用浏览器中更改这项设置。","consent_prompt":"有回复时是否接收通知？"},"dismiss":"忽略","dismiss_notifications":"忽略所有","first_notification":"你的头一个通知！选中它开始。","dynamic_favicon":"在浏览器图标上显示计数","theme_default_on_all_devices":"将其设为我所有设备上的默认主题","text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","allow_private_messages":"允许其他用户发送私信给我","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","silenced_tooltip":"该用户已被禁言。","suspended_permanently":"该用户被封禁了。","email_activity_summary":"活动摘要","mailing_list_mode":{"label":"邮件列表模式","enabled":"启用邮件列表模式","instructions":"此设置将覆盖活动摘要。\u003cbr /\u003e\n静音主题和分类不包含在这些邮件中。\n","individual":"为每个新帖发送一封邮件通知","individual_no_echo":"为每个除了我发表的新帖发送一封邮件通知","many_per_day":"为每个新帖给我发送邮件（大约每天 {{dailyEmailEstimate}} 封）","few_per_day":"为每个新帖给我发送邮件（大约每天 2 封）","warning":"邮件列表模式启用。邮件通知设置被覆盖。"},"watched_tags_instructions":"你将自动关注所有含有这些标签的主题。你会收到所有新帖子和主题的通知，且新帖子的数量也会显示在主题旁边。","tracked_tags_instructions":"你将自动跟踪所有含有这些标签的主题，新帖数量将会显示在主题旁边。","muted_tags_instructions":"你将不会收到有这些标签的新主题任何通知，它们也不会出现在“最新”主题列表。","watched_categories_instructions":"你将自动关注这些分类中的所有主题。你会收到所有新帖子和新主题的通知，新帖数量也会显示在主题旁边。","tracked_categories_instructions":"你将自动跟踪这些分类中的所有主题。新帖数量将会显示在主题旁边。","watched_first_post_categories":"监看新主题","watched_first_post_categories_instructions":"在这些分类里面，每一个新主题的第一帖会通知你。","watched_first_post_tags":"监看新主题","watched_first_post_tags_instructions":"在有了这些标签的每一个新主题，第一帖会通知你。","muted_categories_instructions":"你不会收到有关这些分类中新主题的任何通知，也不会出现在类别或最新页面上。","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","no_category_access":"无法保存，作为审核人你仅具有受限的 分类 访问权限","delete_yourself_not_allowed":"想删除账户请联系管理人员。","muted_users_instructions":"抑制来自这些用户的所有通知。","ignored_users":"忽视","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","automatically_unpin_topics":"当我完整阅读了主题时自动解除置顶。","apps":"应用","revoke_access":"撤销许可","undo_revoke_access":"解除撤销许可","api_approved":"已批准：","api_last_used_at":"最后使用于：","home":"默认主页","staged":"暂存","staff_counters":{"rejected_posts":"被驳回的帖子"},"messages":{"archive":"存档","groups":"我的群组","bulk_select":"选择私信","move_to_inbox":"移动到收件箱","move_to_archive":"存档","failed_to_move":"移动选中私信失败（可能你的网络出问题了）","select_all":"全选"},"preferences_nav":{"emails":"邮件","interface":"界面","apps":"应用"},"change_password":{"choose_new":"输入新密码","choose":"输入密码"},"second_factor_backup":{"title":"两步备份码","enable_long":"启用备份码","manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","copied_to_clipboard":"已复制到剪贴板","copy_to_clipboard_error":"复制到剪贴板时出错","remaining_codes":"你有\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。","codes":{"title":"备份码生成","description":"每个备份码只能使用一次。请存放于安全可读的地方。"}},"second_factor":{"title":"双重验证","enable":"管理两步验证","forgot_password":"忘记密码？","confirm_password_description":"请确认密码后继续","label":"编码","rate_limit":"请等待另一个验证码。","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","disable_description":"请输入来自 app 的验证码","show_key_description":"手动输入","short_description":"使用一次性安全码保护你的账户。\n","extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n","oauth_enabled_warning":"请注意，一旦你的账户启用了双重验证，社交登录将被停用。","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"register":"注册","title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_about":{"error":"提交修改时出错了"},"change_username":{"confirm":"你确定要更改用户名吗？"},"change_email":{"success_staff":"我们已经发送了一封确认信到你现在的邮箱，请按照邮件内指示完成确认。"},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}","image_is_not_a_square":"注意：图片不是正方形的，我们裁剪了部分图像。"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"primary":"主邮箱","secondary":"次邮箱","no_secondary":"没有次邮箱","sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。","instructions":"绝不会被公开显示","frequency":{"other":"仅在 {{count}} 分钟内没有访问时发送邮件给你。"}},"associated_accounts":{"title":"关联账户","connect":"连接","not_connected":"（没有连接）","confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"username":{"instructions":"独一无二，没有空格，简短"},"locale":{"any":"任意"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"title":"最近使用的设备","log_out_all":"全部登出","active":"现在活跃","not_you":"不是你？","show_all":"显示所有（{{count}}）","show_few":"显示部分","was_this_you":"这是你吗？","was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","browser_and_device":"{{browser}}在{{device}}","secure_account":"保护我的账户","latest_post":"你上次发布了......"},"hide_profile_and_presence":"隐藏我的公开个人资料和状态功能","enable_physical_keyboard":"在iPad上启用物理键盘支持","text_size":{"title":"文本大小","smaller":"更小","normal":"普通","larger":"更大","largest":"最大"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"like_notification_frequency":{"title":"用户被赞时通知提醒","first_time_and_daily":"每天首个被赞","first_time":"历史首个被赞","never":"从不"},"email_previous_replies":{"title":"邮件底部包含历史回复","unless_emailed":"首次"},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件","every_30_minutes":"每半小时","every_hour":"每小时","every_month":"每月","every_six_months":"每6个月"},"email_level":{"title":"当有人引用和回复我的帖子、@我或邀请我至主题时，给我发送邮件","only_when_away":"只在离开时"},"email_messages_level":"有人给我发送消息时给我发送邮件","include_tl0_in_digests":"摘要邮件中包含新用户的内容","email_in_reply_to":"在邮件中包含回复内容的节选","new_topic_duration":{"after_1_day":"一天内发布","after_2_days":"两天内发布","after_1_week":"一周内发布","after_2_weeks":"两周内发布"},"auto_track_options":{"after_30_seconds":"30秒后","after_1_minute":"1分钟后","after_2_minutes":"2分钟后","after_3_minutes":"3分钟后","after_4_minutes":"4分钟后","after_5_minutes":"5分钟后","after_10_minutes":"10分钟后"},"notification_level_when_replying":"当我在主题中回复后，将主题设置至","invited":{"sent":"上次发送","none":"无邀请显示。","truncated":{"other":"只显示前 {{count}} 个邀请。"},"redeemed_tab_with_count":"已确认（{{count}}）","pending_tab_with_count":"待确认（{{count}}）","rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","reinvite_all":"重发所有邀请","reinvite_all_confirm":"确定要重发这些邀请吗？","reinvited_all":"所有邀请已重新发送！","generate_link":"复制邀请链接","link_generated":"邀请链接生成成功！","valid_for":"邀请链接只对这个邮件地址有效：%{email}","bulk_invite":{"none":"你还没有邀请任何人。你可以单独邀请用户，也可以通过\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e上传CSV文件\u003c/a\u003e批量邀请。","success":"文件上传成功，当操作完成时将通过私信通知你。","error":"抱歉，文件必须是CSV格式。","confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}},"password":{"instructions":"至少%{count}个字符"},"summary":{"recent_time_read":"最近阅读时间","topic_count":{"other":"创建主题"},"post_count":{"other":"发表帖子"},"likes_given":{"other":"送出"},"likes_received":{"other":"收到"},"days_visited":{"other":"访问天数"},"topics_entered":{"other":"已阅主题"},"posts_read":{"other":"阅读帖子"},"bookmark_count":{"other":"收藏"},"top_replies":"热门回复","no_replies":"暂无回复。","more_replies":"更多回复","top_topics":"热门主题","no_topics":"暂无主题。","more_topics":"更多主题","top_badges":"热门徽章","no_badges":"暂无徽章。","more_badges":"更多徽章","top_links":"热门链接","no_links":"暂无链接。","most_liked_by":"谁赞得最多","most_liked_users":"赞谁最多","most_replied_to_users":"最多回复至","no_likes":"暂无赞。","top_categories":"热门分类"},"avatar":{"header_title":"个人信息、私信、收藏和设置"},"title":{"none":"（无）"},"primary_group":{"none":"（无）"},"stream":{"private_message":"私信"}},"errors":{"reasons":{"not_found":"页面不存在"},"desc":{"not_found":"没有这个页面"}},"modal":{"dismiss_error":"忽略错误"},"read_only_mode":{"enabled":"站点正处于只读模式。你可以继续浏览，但是回复、赞和其他操作暂时被禁用。","logout_disabled":"站点在只读模式下无法登出。"},"logs_error_rate_notice":{},"all_time":"总量","all_time_desc":"创建的主题总量","last_post":"最后发帖","time_read_recently":"最近 %{time_read}","time_read_tooltip":"合计阅读时间 %{time_read}","time_read_recently_tooltip":"总阅读时间 %{time_read}（最近60天 %{recent_time_read}）","last_reply_lowercase":"最后回复","replies_lowercase":{"other":"回复"},"signup_cta":{"hide_session":"明天提醒我","hide_forever":"不了","hidden_for_session":"好的，我会在明天提醒你。不过你随时都可以使用“登录”来创建账户。","intro":"你好！看起来你正在享受讨论，但还没有注册一个账户。","value_prop":"当你创建了账户，我们就可以准确地记录你的阅读进度，你再次访问时就可以回到之前离开的地方。当有人回复你，你可以通过这里或电子邮件收到通知。并且你还可以通过点赞帖子向他人分享你的喜爱之情。:heartbeat:"},"summary":{"description":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 个回复。","description_time":"有 \u003cb\u003e{{replyCount}}\u003c/b\u003e 个回复，大约要花 \u003cb\u003e{{readingTime}} 分钟\u003c/b\u003e阅读。"},"private_message_info":{"title":"私信","invite":"邀请其他人...","edit":"添加或移除...","leave_message":"你真的想要发送消息么？","remove_allowed_user":"确定将 {{name}} 从本条私信中移除？","remove_allowed_group":"确定将 {{name}} 从本条私信中移除？"},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"title":"重置密码","complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","help":"没收到邮件？请先查看你的垃圾邮件文件夹。\u003cp\u003e不确定使用了哪个邮箱地址？输入邮箱地址来查看是否存在。\u003c/p\u003e\u003cp\u003e如果你已无法进入你账户的邮箱，请联系\u003ca href='%{basePath}/about'\u003e我们的工作人员。\u003c/a\u003e\u003c/p\u003e"},"email_login":{"link_label":"给我通过邮件发送一个登录链接","button_label":"通过邮件","complete_username":"如果有一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email":"如果\u003cb\u003e%{email}\u003c/b\u003e与账户相匹配，你很快就会收到一封带有登录链接的电子邮件。","complete_username_found":"我们找到了一个与用户名\u003cb\u003e%{username}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","complete_email_found":"我们发现了一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户，你很快就会收到一封带有登录链接的电子邮件。","logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_title":"双重验证","second_factor_description":"请输入来自 app 的验证码：","second_factor_backup":"使用备用码登录","second_factor_backup_title":"两步验证备份","second_factor_backup_description":"请输入你的备份码：","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","rate_limit":"请请稍后再重试","blank_username":"请输入你的邮件地址或用户名。","omniauth_disallow_totp":"你的账户已启用双重验证，请使用密码登录。","resend_title":"重发激活邮件","change_email":"更改邮件地址","provide_new_email":"给个新地址！然后我们会再给你发一封确认邮件。","submit_new_email":"更新邮件地址","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","to_continue":"请登录","preferences":"需要登入后更改设置","forgot":"我记不清账户详情了","not_approved":"你的账户还未通过审核。一旦审核通过，我们将邮件通知你。","instagram":{"name":"Instagram","title":"Instagram 登录"},"facebook":{"name":"Facebook"},"github":{"name":"GitHub"},"discord":{"name":"Discord","title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"invites":{"invited_by":"邀请你的是：","social_login_available":"你也可以通过任何使用这个邮箱的社交网站登录。","your_email":"你的账户的邮箱地址为\u003cb\u003e%{email}\u003c/b\u003e。","accept_invite":"接受邀请","success":"已创建你的账户，你现在可以登录了。"},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_with_featured_topics":"有推荐主题的分类","categories_and_latest_topics":"分类和最新主题","categories_and_top_topics":"分类和最热主题","categories_boxes":"带子分类的框","categories_boxes_with_topics":"有特色主题的框"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"default_header_text":"选择…","no_content":"无符合的结果","filter_placeholder":"搜索……","filter_placeholder_with_any":"搜索或创建...","create":"创建：“{{content}}”","max_content_reached":{"other":"你只能选择 {{count}} 条记录。"},"min_content_not_reached":{"other":"选择至少{{count}}条。"},"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"from":"从","to":"发至","errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"filter_placeholder":"查找表情符号","smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","activities":"活动","objects":"物品","symbols":"符号","recent":"近期使用","default_tone":"无肤色","light_tone":"浅肤色","medium_light_tone":"中浅肤色","medium_tone":"中间肤色","medium_dark_tone":"中深肤色","dark_tone":"深肤色","default":"自定义表情符号"},"shared_drafts":{"title":"共享草稿","notice":"只有那些可以看到\u003cb\u003e{{category}}\u003c/b\u003e分类的人才能看到此主题。","destination_category":"目标分类","publish":"发布共享草稿","confirm_publish":"你确定要发布此草稿吗？","publishing":"发布主题中......"},"composer":{"emoji":"Emoji :)","more_emoji":"更多…","whisper":"密语","unlist":"隐藏","toggle_whisper":"折叠或展开密语","toggle_unlisted":"显示/隐藏于主题列表","edit_conflict":"编辑冲突","group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","group_mentioned":{"other":"提及 {{group}} 时，你将通知 \u003ca href='{{group_link}}'\u003e{{count}} 人\u003c/a\u003e － 确定吗？"},"cannot_see_mention":{"category":"你提到了 {{username}} ，然而他们不能访问该分类，所以他们不会被通知。你需要把他们加入到能访问该分类的群组中。","private":"你提到了{{userrname}}，然而他们不能访问该私信，所以他们不会被通知。你需要邀请他们至私信中。"},"duplicate_link":"好像\u003cb\u003e@{{username}}\u003c/b\u003e在\u003ca href='{{post_url}}'\u003e{{ago}}\u003c/a\u003e中前的回复中已经发了你的链接 \u003cb\u003e{{domain}}\u003c/b\u003e － 你想再次发表链接吗？","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","tags_missing":"你必须至少选择{{count}}个标签","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"overwrite_edit":"覆盖编辑","create_topic":"创建主题","create_pm":"私信","create_whisper":"密语","create_shared_draft":"创建共享草稿","edit_shared_draft":"编辑共享草稿","title_or_link_placeholder":"输入标题，或粘贴一个链接","topic_featured_link_placeholder":"在标题里输入链接","remove_featured_link":"从主题中移除链接。","reply_placeholder":"在此键入。使用 Markdown，BBCode 或 HTML 格式。可拖拽或粘贴图片。","reply_placeholder_no_images":"在此输入。 使用 Markdown，BBCode 或 HTML 格式。","reply_placeholder_choose_category":"输入前请选择一个分类。","saving":"保存中","saved_draft":"正在发布草稿。点击以继续。","bold_label":"B","italic_label":"I","link_url_placeholder":"粘贴 URL 或键入以搜索主题","paste_code_text":"输入或粘贴代码","toggle_direction":"切换方向","collapse":"最小化编辑面板","open":"打开编辑面板","abandon":"关闭编辑面板并放弃草稿","enter_fullscreen":"进入全屏编辑模式","exit_fullscreen":"退出全屏编辑模式","cant_send_pm":"抱歉，你不能向 %{username} 发送私信。","yourself_confirm":{"title":"你忘记添加收信人了吗？","body":"目前该私信只发给了你自己！"},"composer_actions":{"draft":"草稿","reply_to_post":{"label":"通过%{postUsername}回复帖子%{postNumber}","desc":"回复特定帖子"},"reply_as_new_topic":{"label":"回复为联结主题","desc":"创建一个新主题链接到这一主题","confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"},"reply_as_private_message":{"label":"新消息","desc":"新建一个私信"},"reply_to_topic":{"label":"回复主题","desc":"回复主题，不是任何特定的帖子"},"toggle_whisper":{"label":"切换密语","desc":"只有管理人员才能看到密语"},"shared_draft":{"label":"共享草稿","desc":"起草一个只对管理人员可见的主题"},"toggle_topic_bump":{"label":"切换主题置顶","desc":"回复而不更改最新回复日期"}},"details_text":"此本文本将被隐藏"},"notifications":{"tooltip":{"regular":{"other":"{{count}} 个未读通知"},"message":{"other":"{{count}} 条未读私信"},"high_priority":{"other":"%{count}个未读的高优先级通知"}},"title":"使用@提到你，回复你的内容、私信以及其他的通知","empty":"未发现通知","post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"other":"\u003cspan\u003e{{username}}, {{username2}} 和其他 {{count}} 人\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"other":"你的帖子有{{count}}个赞"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e 已接受你的邀请","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e 移动了 {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"获得 “{{description}}”","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003e新主题\u003c/span\u003e {{description}}","membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","group_message_summary":{"other":"{{count}} 条私信在{{group_name}}组的收件箱中"},"popup":{"mentioned":"{{username}}在“{{topic}}”提到了你 - {{site_title}}","group_mentioned":"{{username}}在“{{topic}}”提到了你 - {{site_title}}","quoted":"{{username}}在“{{topic}}”引用了你的帖子 - {{site_title}}","replied":"{{username}}在“{{topic}}”回复了你 - {{site_title}}","posted":"{{username}}在“{{topic}}”中发布了帖子 - {{site_title}}","private_message":"{{username}}在“{{topic}}”中向你发送了个人消息 - {{site_title}}","linked":"{{username}}在“{{topic}}”中链接了你的帖子 - {{site_title}}","watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","confirm_title":"通知已启用 - %{site_title}","confirm_body":"成功！通知已启用。","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","post_approved":"帖子已审批","membership_request_consolidated":"新的成员申请"}},"upload_selector":{"remote_tip_with_attachments":"链接到图片或文件 {{authorized_extensions}}","local_tip":"从你的设备中选择图片","local_tip_with_attachments":"从你的设备 {{authorized_extensions}} 选择图片或文件","hint_for_supported_browsers":"可以拖放或复制粘帖至编辑器以上传","select_file":"选择文件"},"search":{"sort_by":"排序","relevance":"最相关","latest_post":"最新发帖","latest_topic":"最新主题","most_viewed":"最多阅读","most_liked":"最多赞","select_all":"全选","clear_all":"清除所有","too_short":"你的搜索词太短。","result_count":{"other":"\u003cspan\u003e{{count}}{{plus}}结果\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"full_page_title":"搜索主题或帖子","no_more_results":"没有找到更多结果。","results_page":"关于“{{term}}”的搜索结果","more_results":"还有更多结果。请增加你的搜索条件。","cant_find":"找不到你要找的内容？","start_new_topic":"不如创建一个新主题？","or_search_google":"或者尝试使用Google进行搜索：","search_google":"尝试使用Google进行搜索：","context":{"category":"搜索 #{{category}} 分类","tag":"搜索＃{{tag}}标签","private_messages":"搜索私信"},"advanced":{"title":"高级搜索","in_category":{"label":"分类"},"in_group":{"label":"在该群组中"},"with_badge":{"label":"有该徽章"},"with_tags":{"label":"标签"},"filters":{"label":"只返回主题/帖子……","title":"仅在标题中匹配","likes":"我赞过的","posted":"我参与发帖","created":"我创建的","watching":"我正在监看","tracking":"我正在追踪","private":"在我的私信中","bookmarks":"我收藏了","first":"是第一帖","pinned":"是置顶的","unpinned":"不是置顶的","seen":"我看了","unseen":"我还没看过","wiki":"公共编辑","images":"包含图片","all_tags":"上述所有标签"},"statuses":{"label":"当主题","open":"是开放的","closed":"是关闭的","public":"是公开的","archived":"已经存档的","noreplies":"没有回复","single_user":"只有一个用户参与"},"post":{"count":{"label":"最小帖子数"},"time":{"label":"发表于","before":"之前","after":"之后"}}}},"view_all":"查看全部","topics":{"new_messages_marker":"上次访问","bulk":{"select_all":"选择全部","clear_all":"清除全部","unlist_topics":"未在列表的主题","relist_topics":"把主题重新置于主题列表中","dismiss":"忽略","dismiss_read":"忽略所有未读主题","dismiss_button":"忽略…","dismiss_tooltip":"仅忽略新帖子或停止跟踪主题","also_dismiss_topics":"停止追踪这些主题，这样这些主题就不再显示为未读了","change_category":"设置分类","change_tags":"替换标签","append_tags":"添加标签","choose_new_tags":"为主题选择新标签：","choose_append_tags":"为这些主题添加新标签：","changed_tags":"主题的标签被修改"},"none":{"educate":{"new":"\u003cp\u003e这里显示了近期主题列表。\u003c/p\u003e\u003cp\u003e默认情况下，最近 2 天内创建的主题将显示在近期列表，还会显示一个\u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003e近期\u003c/span\u003e标志。\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e用户设置\u003c/a\u003e中更改要显示哪些内容。\u003c/p\u003e","unread":"\u003cp\u003e这里显示你的未读主题。\u003c/p\u003e\u003cp\u003e默认情况下，下述主题会被放在未读中。并且会在旁边显示未读的数量\u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e。如果你：\u003c/p\u003e\u003cul\u003e\u003cli\u003e创建了该主题\u003c/li\u003e\u003cli\u003e回复了该主题\u003c/li\u003e\u003cli\u003e阅读该主题超过 4 分钟\u003c/li\u003e\u003c/ul\u003e\u003cp\u003e或者你在主题底部的通知控制中选择了跟随或关注。\u003c/p\u003e\u003cp\u003e你可以在\u003ca href=\"%{userPrefsUrl}\"\u003e用户设置\u003c/a\u003e中修改未读设置。\u003c/p\u003e"}}},"topic":{"filter_to":{"other":"本主题中的 {{count}} 帖"},"open_draft":"打开草稿","private_message":"开始发私信","archive_message":{"help":"移动私信到存档","title":"存档"},"move_to_inbox":{"title":"移动到收件箱","help":"移动私信到收件箱"},"edit_message":{"help":"编辑消息中的第一帖","title":"编辑消息"},"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"title":"主题计时器","save":"设置计时器","num_of_hours":"小时数：","num_of_days":"天数","remove":"撤销计时器","publish_to":"发布至：","when":"时间：","public_timer_types":"主题计时器","private_timer_types":"用户主题计时器","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"none":"选择时间范围","later_today":"今天的某个时候","later_this_week":"这周的某个时候","two_months":"两个月","four_months":"四个月","one_year":"一年","forever":"永远","pick_date_and_time":"选择日期和时间","set_based_on_last_post":"按照最新帖子关闭"},"publish_to_category":{"title":"计划发布"},"temp_open":{"title":"临时开启"},"auto_reopen":{"title":"自动开启主题"},"temp_close":{"title":"临时关闭"},"auto_close":{"title":"自动关闭主题","label":"自动关闭于几小时后："},"auto_delete":{"title":"自动删除主题"},"auto_bump":{"title":"自动顶帖"},"reminder":{"title":"提醒我"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_open":"本主题将在%{timeLeft}自动开启。","auto_publish_to_category":"主题%{timeLeft}将发布到\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e 。","auto_delete":"主题在%{timeLeft}后将被自动删除。","auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_reminder":"你将在%{timeLeft}后收到该主题的提醒。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"auto_close_immediate":{"other":"主题中的最后一帖是 %{hours} 小时前发出的，所以主题将会立即关闭。"},"timeline":{"back_description":"回到最后一个未读帖子"},"progress":{"jump_bottom":"跳至最后一个帖子","jump_prompt":"跳到…","jump_prompt_of":"%{count} 帖子","jump_prompt_long":"跳到……","jump_prompt_to_date":"至今"},"notifications":{"title":"改变你收到该主题通知的频率","reasons":{"mailing_list_mode":"邮件列表模式已启用，将以邮件通知你关于该主题的回复。","3_10":"因为你正监看该主题上的标签，你将会收到通知。","2_8":"因为你追踪了该分类，所以你会看到新回复的数量。","2_4":"你会看到新回复的数量的原因是你曾经回复过该主题。","2_2":"你会看到新回复数量的原因是你正在追踪该主题。","2":"你会看到新回复数量的原因是你\u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003e阅读过该主题\u003c/a\u003e。","1_2":"有人@你或回复你时会通知你。","1":"如果有人@你或回复你，将通知你。"},"watching_pm":{"description":"私信有新回复时提醒我，并显示新回复数量。"},"watching":{"description":"你将收到该主题所有新回复的通知，还会显示新回复的数量。"},"tracking_pm":{"description":"在私信标题后显示新回复数量。你只会在别人@你或回复你的帖子时才会收到通知。"},"tracking":{"description":"将为该主题显示新回复的数量。你会在有人@你或回复你的时候收到通知。"},"regular":{"title":"普通","description":"如果有人@你或回复你，将通知你。"},"regular_pm":{"title":"普通","description":"如果有人@你或回复你，将通知你。"},"muted_pm":{"description":"你永远都不会收到任何关于此私信的通知。"},"muted":{"description":"你不会收到关于此主题的任何通知，它也不会出现在“最新”主题列表中。"}},"actions":{"multi_select":"选择帖子…","timed_update":"设置主题计时器…","pin":"置顶主题…","unpin":"取消置顶主题…","make_public":"设置为公共主题","make_private":"设置为私信","reset_bump_date":"重置顶帖日期"},"share":{"extended_title":"分享一个链接"},"print":{"title":"打印","help":"打开该主题对打印友好的版本"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"feature_topic":{"title":"置顶主题","pin":"将该主题置于{{categoryLink}}分类最上方至","confirm_pin":"已有{{count}}个置顶主题。太多的置顶主题可能会困扰新用户和访客。确定想在该分类再置顶一个主题？","unpin":"从{{categoryLink}}分类最上方移除主题。","unpin_until":"从{{categoryLink}}分类最上方移除主题或者移除于\u003cstrong\u003e%{until}\u003c/strong\u003e。","pin_note":"允许用户取消置顶。","pin_validation":"置顶该主题需要一个日期。","not_pinned":"{{categoryLink}}没有置顶主题。","already_pinned":{"other":"{{categoryLink}}分类的置顶主题数：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"将主题置于所有主题列表最上方至","confirm_pin_globally":"已有{{count}}个全局置顶主题。太多的置顶主题可能会困扰新用户和访客。确定想再全局置顶一个主题？","unpin_globally":"将主题从所有主题列表的最上方移除。","unpin_globally_until":"从所有主题列表最上方移除主题或者移除于\u003cstrong\u003e%{until}\u003c/strong\u003e。","global_pin_note":"允许用户取消全局置顶。","not_pinned_globally":"没有全局置顶的主题。","already_pinned_globally":{"other":"全局置顶的主题数：\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"将主题设置为出现在所有页面顶端的横幅主题。","remove_banner":"移除所有页面顶端的横幅主题。","banner_note":"用户能点击关闭隐藏横幅。且只能设置一个横幅主题。","no_banner_exists":"没有横幅主题。","banner_exists":"当前\u003cstrong class='badge badge-notification unread'\u003e设置\u003c/strong\u003e了横幅主题。"},"automatically_add_to_groups":"邀请将把用户加入群组：","invite_private":{"title":"邀请至私信","success":"成功邀请了用户至该私信。","success_group":"成功邀请了群组至该私信。"},"controls":"主题控件","invite_reply":{"action":"发送邀请","help":"通过电子邮件或通知邀请其他人到该主题","sso_enabled":"输入其用户名，邀请其人到本主题。","to_topic_blank":"输入其用户名或者 Email 地址，邀请其人到本主题。","to_topic_email":"你输入了邮箱地址。我们将发送一封邮件邀请，让你的朋友可直接回复该主题。","to_topic_username":"你输入了用户名。我们将发送一个至该主题链接的邀请通知。","to_username":"输入你想邀请的人的用户名。我们将发送一个至该主题链接的邀请通知。","success_email":"我们发了一封邮件邀请\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e。邀请被接受后你会收到通知。检查用户页中的邀请标签页来追踪你的邀请。","success_username":"我们已经邀请了该用户参与该主题。","error":"抱歉，我们不能邀请这个人。可能他已经被邀请了？（邀请有频率限制）","success_existing_email":"用户\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e已存在。我们已经邀请了该用户参与该主题。"},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","radio_label":"创建新私信","participants":"参与者","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","participants":"参与者","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"merge_posts":{"title":"合并选择的帖子","action":"合并选择的帖子","error":"合并帖子时发生了错误。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"title":"更改所有者","instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"change_timestamp":{"title":"修改时间","action":"修改时间","invalid_timestamp":"不能是未来的时间。","error":"更改主题时间时发生错误。","instructions":"请为主题选择新的时间。主题中的所有帖子将按照相同的时间差更新。"},"multi_select":{"select_post":{"title":"将帖子加入选择"},"selected_post":{"label":"已选中","title":"单击以将帖子从中移除"},"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"quote_reply":"引用","ignored":"忽视的内容","wiki_last_edited_on":"维基最后修改于","reply_as_new_private_message":"向相同的收件人回复新私信","show_hidden":"显示已忽略内容。","collapse":"折叠","locked":"一管理人员锁定了该帖的编辑","gap":{"other":"查看 {{count}} 个隐藏回复"},"notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"has_replies":{"other":"{{count}} 回复"},"has_likes_title":{"other":"{{count}} 人赞了该贴"},"has_likes_title_only_you":"你喜欢了这个帖子","has_likes_title_you":{"other":"你和其他 {{count}} 人赞了该贴"},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。","upload_not_authorized":"抱歉，你没有上传文件的权限（验证扩展：{{authorized_extensions}}）。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"via_auto_generated_email":"通过自动生成邮件发表的帖子","whisper":"设置帖子为密语，只对版主可见","wiki":{"about":"这个帖子是维基"},"few_likes_left":"谢谢你的热情！你今天的赞快用完了。","controls":{"read_indicator":"阅读了帖子的用户","delete_replies":{"confirm":"你也想删除该贴的回复？","direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}},"change_owner":"更改作者","lock_post":"锁定帖子","lock_post_description":"禁止发帖者编辑这篇帖子","unlock_post":"解锁帖子","unlock_post_description":"允许发布者编辑帖子","delete_topic_disallowed_modal":"你无权删除该贴。如果你真想删除，向版主提交原因并标记。","delete_topic_disallowed":"你无权删除此主题","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"defer_flags":{"other":"忽略标记"},"people":{"notify_moderators":"通知版主","notify_user":"发送私信","bookmark":"收藏","like":{"other":"点赞"},"read":{"other":"看过"},"like_capped":{"other":"和其他 {{count}} 人赞了它"},"read_capped":{"other":"还有{{count}}个其他用户看过"}},"by_you":{"notify_user":"你已经通知了该用户"}},"delete":{"confirm":{"other":"你确定要删除{{count}}个帖子吗？"}},"merge":{"confirm":{"other":"确定要合并这 {{count}} 个帖子吗？"}},"revisions":{"controls":{"revert":"还原至该版本","edit_wiki":"编辑维基","edit_post":"编辑帖子","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"button":"HTML"},"side_by_side":{"button":"HTML"},"side_by_side_markdown":{"button":"原始"}}},"raw_email":{"displays":{"raw":{"title":"显示原始邮件地址","button":"原始"},"text_part":{"title":"显示邮件的文字部分","button":"文字"},"html_part":{"title":"显示邮件的 HTML 部分","button":"HTML"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"all":"所有分类","choose":"分类\u0026hellip;","edit_dialog_title":"编辑: %{categoryName}","topic_template":"主题模板","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_placeholder":"（可选）允许使用的标签列表","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_groups_placeholder":"（可选）允许使用的标签组列表","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","topic_featured_link_allowed":"允许在该分类中发布特色链接标题","create_long":"创建新的分类","special_warning":"警告：这是一个预设的分类，它的安全设置不能被更改。如果你不想要使用这个分类，直接删除它，而不是另作他用。","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","show_subcategory_list":"在这个分类中把子分类列表显示在主题的上面","num_featured_topics":"分类页面上显示的主题数量：","subcategory_num_featured_topics":"父分类页面上的推荐主题数量：","all_topics_wiki":"默认将新主题设为维基主题","subcategory_list_style":"子分类列表样式：","sort_order":"主题排序依据：","default_view":"默认主题列表：","default_top_period":"默认热门时长：","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching":{"description":"你将自动关注这些分类中的所有主题。你会收到所有新主题中的每一个新帖的通知，还会显示新回复的数量。"},"watching_first_post":{"title":"监看新主题","description":"你将收到此分类中的新主题通知，不包括回复。"},"tracking":{"description":"你将自动跟踪这些分类中的所有主题。如果有人@你或回复你，将通知你，还将显示新回复的数量。"},"regular":{"title":"普通","description":"如果有人@你或回复你，将通知你。"},"muted":{"description":"在这些分类里面，你将不会收到新主题任何通知，它们也不会出现在“最新”主题列表。 "}},"search_priority":{"label":"搜索优先级","options":{"normal":"普通","ignore":"忽视","very_low":"非常低","low":"低","high":"高","very_high":"非常高"}},"sort_options":{"default":"默认","op_likes":"原始帖子赞","posters":"发表人","votes":"投票"},"sort_ascending":"升序","sort_descending":"降序","subcategory_list_styles":{"rows":"行","rows_with_featured_topics":"有推荐主题的行","boxes":"盒子","boxes_with_featured_topics":"有推荐主题的盒子"},"settings_sections":{"moderation":"审核","appearance":"主题"}},"flagging":{"notify_action":"私信","official_warning":"正式警告","notify_staff":"私下通知管理人员","custom_message":{"at_least":{"other":"输入至少 {{count}} 个字符"},"more":{"other":"还差 {{count}} 个…"},"left":{"other":"剩余 {{count}}"}}},"flagging_topic":{"notify_action":"私信"},"topic_map":{"participants_title":"主要发帖者","links_title":"热门链接","links_shown":"显示更多链接…"},"post_links":{"about":"为本帖展开更多链接","title":{"other":"%{count} 更多"}},"topic_statuses":{"locked_and_archived":{"help":"这个主题被关闭并存档；不再允许新的回复，并不能改变"},"pinned_globally":{"help":"本主题已全局置顶；它始终会在最新列表以及它所属的分类中置顶"},"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"views_lowercase":{"other":"浏览"},"views_long":{"other":"本主题已经被浏览过 {{number}} 次"},"likes_lowercase":{"other":"赞"},"raw_email":{"title":"进站邮件"},"filters":{"latest":{"title_with_count":{"other":"最新（{{count}}）"}},"unread":{"title_with_count":{"other":"未读（{{count}}）"},"lower_title_with_count":{"other":"{{count}} 未读"}},"new":{"lower_title_with_count":{"other":"{{count}} 近期"},"title_with_count":{"other":"近期（{{count}}）"}},"category":{"title_with_count":{"other":"{{categoryName}} ({{count}})"}},"top":{"yearly":{"title":"年度"},"quarterly":{"title":"季度"},"monthly":{"title":"月度"},"weekly":{"title":"每周"},"daily":{"title":"每天"},"this_year":"年","this_quarter":"季","this_month":"月","this_week":"周","other_periods":"查看热门"},"votes":{"title":"推荐","help":"选票最多的主题"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","jump_to":{"bookmarks":"%{shortcut} 收藏","profile":"%{shortcut} 个人页面","messages":"%{shortcut} 私信","drafts":"%{shortcut}草稿"},"navigation":{"up_down":"%{shortcut} 移动选择焦点 \u0026uarr; \u0026darr;","go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"application":{"hamburger_menu":"%{shortcut} 打开汉堡菜单","search":"%{shortcut} 搜索","log_out":"%{shortcut} 退出"},"composing":{"title":"编辑","return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"bookmark_topic":"%{shortcut} 切换主题收藏状态","quote_post":"%{shortcut} 引用帖子","print":"%{shortcut} 打印主题","defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"badges":{"earned_n_times":{"other":"已获得此徽章 %{count} 次"},"granted_on":"授予于%{date}","others_count":"其他有该徽章的人（%{count}）","allow_title":"你可以将该徽章设为头衔","multiple_grant":"可多次获得","badge_count":{"other":"%{count} 个徽章"},"more_badges":{"other":"+%{count} 更多"},"granted":{"other":"%{count} 已授予"},"none":"（无）","successfully_granted":"成功将 %{badge} 授予 %{username}"},"tagging":{"all_tags":"所有标签","other_tags":"其他标签","selector_all_tags":"所有标签","selector_no_tags":"无标签","changed":"标签被修改：","choose_for_topic":"可选标签","info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_tag":"删除标签","delete_confirm":{"other":"你确定你想要删除这个标签以及撤销在{{count}}个主题中的关联么？"},"delete_confirm_no_topics":"你确定你想要删除这个标签吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"rename_tag":"重命名标签","rename_instructions":"标签的新名称：","sort_by":"排序方式：","sort_by_count":"总数","sort_by_name":"名称","manage_groups":"管理标签组","manage_groups_description":"管理标签的群组","upload":"上传标签","upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","upload_successful":"标签上传成功","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","filters":{"without_category":"%{tag}的%{filter}主题","with_category":"%{filter} %{tag}主题在%{category}","untagged_without_category":"无标签的%{filter}主题","untagged_with_category":"%{category}无标签的%{filter}主题"},"notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"title":"监控新主题","description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"title":"标签组","about":"将标签分组以便管理。","new":"新标签组","tags_label":"标签组内标签：","tags_placeholder":"标签","parent_tag_label":"上级标签：","parent_tag_placeholder":"可选","parent_tag_description":"未设置上级标签前群组内标签无法使用。","one_per_topic_label":"只可给主题设置一个该组内的标签","new_name":"新建标签组","name_placeholder":"标签组名称","confirm_delete":"确定要删除此标签组吗？","everyone_can_use":"每个人都可以使用标签","usable_only_by_staff":"标签对所有人可见，但只有管理人员可以使用它们","visible_only_to_staff":"标签仅对管理人员可见"},"topics":{"none":{"latest":"没有最新主题。"}}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。","custom_message_placeholder":"输入留言","custom_message_template_forum":"你好，你应该加入这个论坛！","custom_message_template_topic":"你好，我觉得你可能会喜欢这个主题！"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","safe_mode":{"enabled":"安全模式已经开启，关闭该浏览器窗口以退出安全模式"},"poll":{"voters":{"other":"投票者"},"total_votes":{"other":"总票数"},"average_rating":"平均评分：\u003cstrong\u003e%{average}\u003c/strong\u003e。","public":{"title":"投票为\u003cstrong\u003e公开\u003c/strong\u003e。"},"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"multiple":{"help":{"at_least_min_options":{"other":"至少选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"up_to_max_options":{"other":"最多选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"x_options":{"other":"选择 \u003cstrong\u003e%{count}\u003c/strong\u003e 个选项"},"between_min_and_max_options":"选择 \u003cstrong\u003e%{min}\u003c/strong\u003e 至 \u003cstrong\u003e%{max}\u003c/strong\u003e 个选项"}},"cast-votes":{"title":"投你的票","label":"现在投票！"},"show-results":{"title":"显示投票结果","label":"显示结果"},"hide-results":{"title":"返回到你的投票","label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"open":{"title":"开启投票","label":"开启","confirm":"你确定要开启这个投票么？"},"close":{"title":"关闭投票","confirm":"你确定要关闭这个投票？"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_toggling_status":"对不起，改变投票状态时出错了。","error_while_casting_votes":"对不起，投票时出错了。","error_while_fetching_voters":"对不起，显示投票者时出错了。","error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"title":"创建投票","insert":"插入投票","help":{"options_count":"至少输入1个选项","invalid_values":"最小值必须小于最大值。","min_step_value":"最小步长为1"},"poll_type":{"regular":"单选","multiple":"多选","number":"评分"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"poll_config":{"max":"最大","min":"最小","step":"梯级"},"poll_public":{"label":"显示投票人"},"poll_options":{"label":"每行输入一个调查选项"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"给所有新用户启动新用户向导","welcome_message":"给所有新用户发送快速开始指南，作为欢迎消息"}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}","countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"insert":"插入","advanced_mode":"高级模式","simple_mode":"简单模式","format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_title":"要显示的时区","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_title":"循环","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","recurring_none":"没有循环","invalid_date":"日期无效，请确保日期和时间正确","date_title":"日期","format_title":"日期格式","timezone":"时区","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"details":{"title":"隐藏详情"},"presence":{"replying":"正在回复","editing":"正在编辑","replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","reached_limit":"你没有选票了，先删除一张已选票！","list_votes":"显示你的投票","votes_nav_help":"选票最多的主题","voted":"你在该主题中已经投过票了","allow_topic_voting":"允许用户在此分类中为主帖点推荐","vote_title_plural":"推荐","voted_title":"已投票","voting_closed_title":"已结束推荐","voting_limit":"次数限制","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"},"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"dates":{"tiny":{"less_than_x_minutes":{"one":"\u003c %{count}m"},"x_months":{"one":"%{count}mon"}},"medium_with_ago":{"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}},"later":{"x_months":{"one":"%{count} month later"},"x_years":{"one":"%{count} year later"}}},"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"%{count} user"}},"groups":{"title":{"one":"Group"}},"categories":{"topic_sentence":{"one":"%{count} topic"},"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"given"},"likes_received":{"one":"received"},"days_visited":{"one":"day visited"},"topics_entered":{"one":"topic viewed"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"local_time":"Local Time","replies_lowercase":{"one":"reply"},"email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?"}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts"},"group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topic":{"filter_to":{"one":"%{count} post in topic"},"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"}},"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"gap":{"one":"view %{count} hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes_title":{"one":"%{count} person liked this post"},"has_likes_title_you":{"one":"you and %{count} other person liked this post"},"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?"}}},"flagging":{"custom_message":{"at_least":{"one":"enter at least %{count} character"},"more":{"one":"%{count} to go..."},"left":{"one":"%{count} remaining"}}},"post_links":{"title":{"one":"%{count} more"}},"views_lowercase":{"one":"view"},"views_long":{"one":"this topic has been viewed %{count} time"},"likes_lowercase":{"one":"like"},"filters":{"latest":{"title_with_count":{"one":"Latest (%{count})"}},"unread":{"title_with_count":{"one":"Unread (%{count})"},"lower_title_with_count":{"one":"%{count} unread"}},"new":{"lower_title_with_count":{"one":"%{count} new"},"title_with_count":{"one":"New (%{count})"}},"category":{"title_with_count":{"one":"{{categoryName}} (%{count})"}}},"badges":{"earned_n_times":{"one":"Earned this badge %{count} time"},"badge_count":{"one":"%{count} Badge"},"more_badges":{"one":"+%{count} More"},"granted":{"one":"%{count} granted"}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option"}}},"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'te';
I18n.pluralizationRules.te = MessageFormat.locale.te;
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


    var te = moment.defineLocale('te', {
        months : 'జనవరి_ఫిబ్రవరి_మార్చి_ఏప్రిల్_మే_జూన్_జులై_ఆగస్టు_సెప్టెంబర్_అక్టోబర్_నవంబర్_డిసెంబర్'.split('_'),
        monthsShort : 'జన._ఫిబ్ర._మార్చి_ఏప్రి._మే_జూన్_జులై_ఆగ._సెప్._అక్టో._నవ._డిసె.'.split('_'),
        monthsParseExact : true,
        weekdays : 'ఆదివారం_సోమవారం_మంగళవారం_బుధవారం_గురువారం_శుక్రవారం_శనివారం'.split('_'),
        weekdaysShort : 'ఆది_సోమ_మంగళ_బుధ_గురు_శుక్ర_శని'.split('_'),
        weekdaysMin : 'ఆ_సో_మం_బు_గు_శు_శ'.split('_'),
        longDateFormat : {
            LT : 'A h:mm',
            LTS : 'A h:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY, A h:mm',
            LLLL : 'dddd, D MMMM YYYY, A h:mm'
        },
        calendar : {
            sameDay : '[నేడు] LT',
            nextDay : '[రేపు] LT',
            nextWeek : 'dddd, LT',
            lastDay : '[నిన్న] LT',
            lastWeek : '[గత] dddd, LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : '%s లో',
            past : '%s క్రితం',
            s : 'కొన్ని క్షణాలు',
            ss : '%d సెకన్లు',
            m : 'ఒక నిమిషం',
            mm : '%d నిమిషాలు',
            h : 'ఒక గంట',
            hh : '%d గంటలు',
            d : 'ఒక రోజు',
            dd : '%d రోజులు',
            M : 'ఒక నెల',
            MM : '%d నెలలు',
            y : 'ఒక సంవత్సరం',
            yy : '%d సంవత్సరాలు'
        },
        dayOfMonthOrdinalParse : /\d{1,2}వ/,
        ordinal : '%dవ',
        meridiemParse: /రాత్రి|ఉదయం|మధ్యాహ్నం|సాయంత్రం/,
        meridiemHour : function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === 'రాత్రి') {
                return hour < 4 ? hour : hour + 12;
            } else if (meridiem === 'ఉదయం') {
                return hour;
            } else if (meridiem === 'మధ్యాహ్నం') {
                return hour >= 10 ? hour : hour + 12;
            } else if (meridiem === 'సాయంత్రం') {
                return hour + 12;
            }
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 4) {
                return 'రాత్రి';
            } else if (hour < 10) {
                return 'ఉదయం';
            } else if (hour < 17) {
                return 'మధ్యాహ్నం';
            } else if (hour < 20) {
                return 'సాయంత్రం';
            } else {
                return 'రాత్రి';
            }
        },
        week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 6th is the first week of the year.
        }
    });

    return te;

})));

// moment-timezone-localization for lang code: te

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"అబిడ్జాన్","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"అక్రా","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"యాడిస్ అబాబా","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"అల్జియర్స్","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"అస్మారా","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"బామాకో","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"బాంగుయ్","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"బంజూల్","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"బిస్సావ్","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"బ్లాన్టైర్","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"బ్రాజావిల్లే","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"బుజమ్బురా","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"కైరో","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"కాసాబ్లాంకా","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"స్యూటా","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"కోనాక్రీ","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"డకార్","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"దార్ ఎస్ సలామ్","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"డిజ్బౌటి","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"డౌలా","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"ఎల్ ఎయున్","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"ఫ్రీటౌన్","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"గబోరోన్","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"హరారే","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"జొహెన్స్‌బర్గ్","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"జుబా","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"కంపాలా","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"ఖార్టోమ్","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"కీగలి","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"కిన్షాసా","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"లాగోస్","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"లెబర్విల్లే","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"లోమ్","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"లువాండా","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"లుబంబాషి","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"లుసాకా","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"మలాబో","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"మాపుటో","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"మసేరు","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"బాబెన్","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"మోగాదిషు","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"మోన్రోవియా","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"నైరోబీ","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"డ్జామెనా","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"నియామే","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"న్వాక్షోట్","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"ఔగాడౌగోవ్","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"పోర్టో-నోవో","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"సావో టోమ్","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"ట్రిపోలి","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"ట్యునిస్","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"విండ్హోక్","id":"Africa/Windhoek"},{"value":"America/Adak","name":"అడాక్","id":"America/Adak"},{"value":"America/Anchorage","name":"యాంకరేజ్","id":"America/Anchorage"},{"value":"America/Anguilla","name":"ఆంగ్విల్లా","id":"America/Anguilla"},{"value":"America/Antigua","name":"ఆంటిగ్వా","id":"America/Antigua"},{"value":"America/Araguaina","name":"అరాగ్వేయీనా","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"లా రియోజ","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"రియో గల్లేగోస్","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"సాల్టా","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"శాన్ జ్యూన్","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"శాన్ లూయిస్","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"టుకుమన్","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"ఉష్యూయ","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"అరుబా","id":"America/Aruba"},{"value":"America/Asuncion","name":"అసున్సియోన్","id":"America/Asuncion"},{"value":"America/Bahia","name":"బహియ","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"బహియా బండరాస్","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"బార్బడోస్","id":"America/Barbados"},{"value":"America/Belem","name":"బెలెమ్","id":"America/Belem"},{"value":"America/Belize","name":"బెలీజ్","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"బ్లాంక్-సబ్లోన్","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"బోవా విస్టా","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"బగోటా","id":"America/Bogota"},{"value":"America/Boise","name":"బొయిసీ","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"బ్యూనోస్ ఎయిర్స్","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"కేంబ్రిడ్జ్ బే","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"కాంపో గ్రాండ్","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"కన్‌కూన్","id":"America/Cancun"},{"value":"America/Caracas","name":"కారాకస్","id":"America/Caracas"},{"value":"America/Catamarca","name":"కటమార్కా","id":"America/Catamarca"},{"value":"America/Cayenne","name":"కయేన్","id":"America/Cayenne"},{"value":"America/Cayman","name":"కేమాన్","id":"America/Cayman"},{"value":"America/Chicago","name":"చికాగో","id":"America/Chicago"},{"value":"America/Chihuahua","name":"చువావా","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"అటికోకన్","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"కోర్డోబా","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"కోస్టా రికా","id":"America/Costa_Rica"},{"value":"America/Creston","name":"క్రెస్టన్","id":"America/Creston"},{"value":"America/Cuiaba","name":"కుయబా","id":"America/Cuiaba"},{"value":"America/Curacao","name":"కురాకవో","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"డెన్మార్క్‌షాన్","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"డాసన్","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"డాసన్ క్రీక్","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"డెన్వెర్","id":"America/Denver"},{"value":"America/Detroit","name":"డిట్రోయిట్","id":"America/Detroit"},{"value":"America/Dominica","name":"డొమినికా","id":"America/Dominica"},{"value":"America/Edmonton","name":"ఎడ్మోంటన్","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"ఇరునెప్","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"ఎల్ సాల్వడోర్","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"ఫోర్ట్ నెల్సన్","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"ఫోర్టలేజా","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"గ్లేస్ బే","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"నూక్","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"గూస్ బే","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"గ్రాండ్ టర్క్","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"గ్రెనడా","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"గ్వాడెలోప్","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"గ్వాటిమాలా","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"గయాక్విల్","id":"America/Guayaquil"},{"value":"America/Guyana","name":"గయానా","id":"America/Guyana"},{"value":"America/Halifax","name":"హాలిఫాక్స్","id":"America/Halifax"},{"value":"America/Havana","name":"హవానా","id":"America/Havana"},{"value":"America/Hermosillo","name":"హెర్మోసిల్లో","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"నోక్స్, ఇండియాన","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"మరెంగో, ఇండియాన","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"పీటర్స్‌బర్గ్, ఇండియాన","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"టెల్ నగరం, ఇండియాన","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"వెవయ్, ఇండియాన","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"విన్‌సెన్నెస్, ఇండియాన","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"వినామాక్, ఇండియాన","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"ఇండియానపోలిస్","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"ఇనువిక్","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"ఇక్వాలిట్","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"జమైకా","id":"America/Jamaica"},{"value":"America/Jujuy","name":"జుజుయ్","id":"America/Jujuy"},{"value":"America/Juneau","name":"జూనో","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"మోంటిసెల్లో, కెన్‌టుక్కీ","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"క్రలెండ్జిక్","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"లా పాజ్","id":"America/La_Paz"},{"value":"America/Lima","name":"లిమా","id":"America/Lima"},{"value":"America/Los_Angeles","name":"లాస్ ఏంజల్స్","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"లూయివిల్","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"లోయర్ ప్రిన్స్ క్వార్టర్","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"మాసియో","id":"America/Maceio"},{"value":"America/Managua","name":"మనాగువా","id":"America/Managua"},{"value":"America/Manaus","name":"మనాస్","id":"America/Manaus"},{"value":"America/Marigot","name":"మారిగోట్","id":"America/Marigot"},{"value":"America/Martinique","name":"మార్టినీక్","id":"America/Martinique"},{"value":"America/Matamoros","name":"మాటమొరోస్","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"మాసట్‌లాన్","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"మెండోజా","id":"America/Mendoza"},{"value":"America/Menominee","name":"మెనోమినీ","id":"America/Menominee"},{"value":"America/Merida","name":"మెరిడా","id":"America/Merida"},{"value":"America/Metlakatla","name":"మెట్లకట్ల","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"మెక్సికో నగరం","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"మికెలాన్","id":"America/Miquelon"},{"value":"America/Moncton","name":"మోన్‌క్టోన్","id":"America/Moncton"},{"value":"America/Monterrey","name":"మోంటెర్రే","id":"America/Monterrey"},{"value":"America/Montevideo","name":"మోంటెవీడియో","id":"America/Montevideo"},{"value":"America/Montserrat","name":"మాంట్సెరాట్","id":"America/Montserrat"},{"value":"America/Nassau","name":"నాస్సావ్","id":"America/Nassau"},{"value":"America/New_York","name":"న్యూయార్క్","id":"America/New_York"},{"value":"America/Nipigon","name":"నిపిగోన్","id":"America/Nipigon"},{"value":"America/Nome","name":"నోమ్","id":"America/Nome"},{"value":"America/Noronha","name":"నరోన్హా","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"బ్యులా, ఉత్తర డకోట","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"సెంటర్, ఉత్తర డకోటా","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"న్యూ సలేమ్, ఉత్తర డకోట","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"ఒజినగ","id":"America/Ojinaga"},{"value":"America/Panama","name":"పనామా","id":"America/Panama"},{"value":"America/Pangnirtung","name":"పాంగ్‌నీర్‌టుంగ్","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"పరామారిబో","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"ఫినిక్స్","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"పోర్ట్-అవ్-ప్రిన్స్","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"పోర్ట్ ఆఫ్ స్పెయిన్","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"పోర్టో వెల్హో","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"ప్యూర్టో రికో","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"పుంటా అరీనస్","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"రెయినీ రివర్","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"రన్‌కిన్ ఇన్‌లెట్","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"రెసిఫీ","id":"America/Recife"},{"value":"America/Regina","name":"రెజీనా","id":"America/Regina"},{"value":"America/Resolute","name":"రిజల్యూట్","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"రియో బ్రాంకో","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"శాంటా ఇసబెల్","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"సాంటరెమ్","id":"America/Santarem"},{"value":"America/Santiago","name":"శాంటియాగో","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"శాంటో డోమింగో","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"సావో పాలో","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"ఇటోక్కోర్టూర్మిట్","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"సిట్కా","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"సెయింట్ బర్తెలెమీ","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"సెయింట్ జాన్స్","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"సెయింట్ కిట్స్","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"సెయింట్ లూసియా","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"సెయింట్ థామస్","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"సెయింట్ విన్సెంట్","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"స్విఫ్ట్ కరెంట్","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"తెగుసిగల్పా","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"థులే","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"థండర్ బే","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"టిజువానా","id":"America/Tijuana"},{"value":"America/Toronto","name":"టొరంటో","id":"America/Toronto"},{"value":"America/Tortola","name":"టోర్టోలా","id":"America/Tortola"},{"value":"America/Vancouver","name":"వాన్కూవర్","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"వైట్‌హార్స్","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"విన్నిపెగ్","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"యకుటాట్","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"ఎల్లోనైఫ్","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"కేసీ","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"డెవిస్","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"డ్యూమాంట్ డి’ఉర్విల్లే","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"మకారీ","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"మాసన్","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"మెక్‌ముర్డో","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"పాల్మర్","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"రొతేరా","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"స్యోవా","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"ట్రోల్","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"వోస్టోక్","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"లాంగ్‌యియర్‌బైయన్","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"ఎడెన్","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"ఆల్మాటి","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"అమ్మన్","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"అనడైర్","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"అక్టావ్","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"అక్టోబ్","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"యాష్గాబాట్","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"ఆటిరా","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"బాగ్దాద్","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"బహ్రెయిన్","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"బాకు","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"బ్యాంకాక్","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"బార్నాల్","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"బీరట్","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"బిష్కెక్","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"బ్రూనై","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"కోల్‌కతా","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"చితా","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"చోయిబాల్సన్","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"కొలంబో","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"డమాస్కస్","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"ఢాకా","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"డిలి","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"దుబాయి","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"డుషన్బీ","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"ఫామగుస్టా","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"గాజా","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"హెబ్రాన్","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"హాంకాంగ్","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"హోవ్డ్","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"ఇర్కుట్స్క్","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"జకార్తా","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"జయపుర","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"జరూసలేం","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"కాబుల్","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"కమ్‌చత్కా","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"కరాచీ","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"ఖాట్మండు","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"కంద్యాగ","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"క్రసనోయార్స్క్","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"కౌలాలంపూర్","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"కుచింగ్","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"కువైట్","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"మకావ్","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"మగడాన్","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"మకాస్సర్","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"మనీలా","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"మస్కట్","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"నికోసియా","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"నొవొకుజ్‌నెట్‌స్క్","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"నవోసిబిర్స్క్","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"ఓమ్స్క్","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"ఓరల్","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"నోమ్‌పెన్హ్","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"పొన్టియనాక్","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"ప్యోంగాంగ్","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"ఖతార్","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"క్విజిలోర్డా","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"యాంగన్","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"రియాధ్","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"హో చి మిన్హ్ నగరం","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"సఖాలిన్","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"సమర్కాండ్","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"సియోల్","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"షాంఘై","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"సింగపూర్","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"స్రెడ్నెకొలిమ్స్క్","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"తైపీ","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"తాష్కెంట్","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"టిబిలిసి","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"టెహ్రాన్","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"థింఫు","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"టోక్యో","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"టామ్స్క్","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"ఉలాన్బాటర్","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"ఉరుమ్‌కీ","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"అస్ట్-నెరా","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"వియన్టైన్","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"వ్లాడివోస్టోక్","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"యకుట్స్క్","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"యెకటెరింబర్గ్","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"యెరెవన్","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"అజోర్స్","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"బెర్ముడా","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"కెనరీ","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"కేప్ వెర్డె","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"ఫారో","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"మదైరా","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"రెక్జావిక్","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"దక్షిణ జార్జియా","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"సెయింట్ హెలెనా","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"స్టాన్లీ","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"అడెలైడ్","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"బ్రిస్‌బెయిన్","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"బ్రోకెన్ హిల్","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"కర్రీ","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"డార్విన్","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"యుక్లా","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"హోబర్ట్","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"లిండెమాన్","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"లార్డ్ హౌ","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"మెల్బోర్న్","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"పెర్త్","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"సిడ్నీ","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"సమన్వయ సార్వజనీన సమయం","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"ఆమ్‌స్టర్‌డామ్","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"అండోరా","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"అస్ట్రఖాన్","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"ఏథెన్స్","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"బెల్‌గ్రేడ్","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"బెర్లిన్","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"బ్రాటిస్లావా","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"బ్రస్సెల్స్","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"బుకారెస్ట్","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"బుడాపెస్ట్","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"బసింజన్","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"చిసినావ్","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"కోపెన్హాగన్","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"ఐరిష్ ప్రామాణిక సమయండబ్లిన్","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"జిబ్రాల్టర్","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"గ్వెర్న్సే","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"హెల్సింకి","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"ఐల్ ఆఫ్ మేన్","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"ఇస్తాంబుల్","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"జెర్సీ","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"కలినిన్‌గ్రద్","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"కీవ్","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"కిరోవ్","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"లిస్బన్","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"ల్యూబ్ల్యానా","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"బ్రిటీష్ వేసవి సమయంలండన్","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"లక్సెంబర్గ్","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"మాడ్రిడ్","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"మాల్టా","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"మారీయుహమ్","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"మిన్స్క్","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"మొనాకో","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"మాస్కో","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"ఓస్లో","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"ప్యారిస్","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"పోడ్గోరికా","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"ప్రాగ్","id":"Europe/Prague"},{"value":"Europe/Riga","name":"రీగా","id":"Europe/Riga"},{"value":"Europe/Rome","name":"రోమ్","id":"Europe/Rome"},{"value":"Europe/Samara","name":"సమార","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"శాన్ మారినో","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"సరాజోవో","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"సరాటవ్","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"సిమ్‌ఫెరోపోల్","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"స్కోప్‌యే","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"సోఫియా","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"స్టాక్హోమ్","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"తాల్లిన్","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"టిరేన్","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"ఉల్యనోవ్స్క్","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"ఉజ్‌హోరోడ్","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"వాడుజ్","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"వాటికన్","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"వియన్నా","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"విల్నియస్","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"వోల్గోగ్రాడ్","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"వార్షా","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"జాగ్రెబ్","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"జపరోజై","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"జ్యూరిచ్","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"అంటానానారివో","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"చాగోస్","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"క్రిస్మస్","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"కోకోస్","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"కొమోరో","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"కెర్గ్యూలెన్","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"మాహె","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"మాల్దీవులు","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"మారిషస్","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"మయోట్","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"రీయూనియన్","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"ఏపియా","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"ఆక్లాండ్","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"బొగెయిన్‌విల్లే","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"చాథమ్","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"ఈస్టర్","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"ఇఫేట్","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"ఎండర్బెరీ","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"ఫాకోఫో","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"ఫీజీ","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"ఫునాఫుటి","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"గాలాపాగోస్","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"గాంబియేర్","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"గ్వాడల్కెనాల్","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"గ్వామ్","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"హోనోలులు","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"జాన్సటన్","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"కిరీటిమాటి","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"కోస్రే","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"క్వాజాలైన్","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"మజురో","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"మార్క్వేసాస్","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"మిడ్వే","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"నౌరు","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"నియూ","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"నోర్ఫోక్","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"నౌమియా","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"పాగో పాగో","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"పాలావ్","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"పిట్‌కైర్న్","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"పోన్‌పై","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"పోర్ట్ మోరెస్బే","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"రరోటోంగా","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"సాయ్పాన్","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"తహితి","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"టరావా","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"టోంగాటాపు","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"చుక్","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"వేక్","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"వాల్లిస్","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
